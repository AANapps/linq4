import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

admin.initializeApp();
const db = admin.firestore();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

function stripe(key: string) {
  return new Stripe(key);
}

// Create a Stripe Billing Portal session so vendors can manage their subscription
export const createPortalSession = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

    const { storeId, returnUrl } = request.data as { storeId: string; returnUrl: string };
    if (!storeId || !returnUrl) throw new HttpsError('invalid-argument', 'storeId and returnUrl required');

    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found');
    const store = storeSnap.data()!;
    if (store.ownerUid !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your store');
    if (!store.stripeCustomerId) throw new HttpsError('failed-precondition', 'No billing account found');

    const s = stripe(stripeSecretKey.value());
    const session = await s.billingPortal.sessions.create({
      customer: store.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }
);

// Stripe webhook — updates Firestore subscription status from Stripe events
export const stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret], cors: false },
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) { res.status(400).send('Missing stripe-signature'); return; }

    let event: Stripe.Event;
    try {
      const s = stripe(stripeSecretKey.value());
      event = s.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret.value());
    } catch (err: any) {
      console.error('Webhook signature failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // For subscriptions created via Payment Link, storeId comes from client_reference_id on the session.
    // For subscriptions updated/deleted, storeId comes from subscription metadata (set after first checkout).
    const getStoreIdFromSub = (sub: { metadata?: Stripe.Metadata | null }) =>
      sub.metadata?.storeId ?? null;

    switch (event.type) {
      // Payment Link fires checkout.session.completed — use client_reference_id as storeId
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const storeId = session.client_reference_id;
        if (!storeId || !session.subscription) break;

        const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as Stripe.Subscription).id;
        const s = stripe(stripeSecretKey.value());
        const sub = await s.subscriptions.retrieve(subId);

        // Tag the subscription with storeId so future events can find the store
        await s.subscriptions.update(subId, { metadata: { storeId } });

        const customerId = typeof session.customer === 'string' ? session.customer : (session.customer as Stripe.Customer | null)?.id ?? '';

        await db.collection('stores').doc(storeId).update({
          subscriptionStatus: sub.status,
          subscriptionId: sub.id,
          stripeCustomerId: customerId,
          subscriptionEnd: admin.firestore.Timestamp.fromMillis(sub.current_period_end * 1000),
        });
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const storeId = getStoreIdFromSub(sub);
        if (storeId) {
          await db.collection('stores').doc(storeId).update({
            subscriptionStatus: sub.status,
            subscriptionEnd: admin.firestore.Timestamp.fromMillis(sub.current_period_end * 1000),
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const storeId = getStoreIdFromSub(sub);
        if (storeId) {
          await db.collection('stores').doc(storeId).update({
            subscriptionStatus: 'cancelled',
            subscriptionId: admin.firestore.FieldValue.delete(),
            subscriptionEnd: admin.firestore.FieldValue.delete(),
          });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const subId = typeof inv.subscription === 'string' ? inv.subscription : (inv.subscription as Stripe.Subscription | null)?.id;
        if (!subId) break;
        const s = stripe(stripeSecretKey.value());
        const sub = await s.subscriptions.retrieve(subId);
        const storeId = getStoreIdFromSub(sub);
        if (storeId) {
          await db.collection('stores').doc(storeId).update({ subscriptionStatus: 'past_due' });
        }
        break;
      }
    }

    res.json({ received: true });
  }
);
