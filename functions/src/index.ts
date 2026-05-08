import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

admin.initializeApp();
const db = admin.firestore();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const stripePriceId = defineSecret('STRIPE_PRICE_ID');

function stripe(key: string) {
  return new Stripe(key);
}

// Create a Stripe Checkout session and return the hosted URL
export const createCheckoutSession = onCall(
  { secrets: [stripeSecretKey, stripePriceId] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

    const { storeId, returnUrl } = request.data as { storeId: string; returnUrl: string };
    if (!storeId || !returnUrl) throw new HttpsError('invalid-argument', 'storeId and returnUrl required');

    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) throw new HttpsError('not-found', 'Store not found');
    const store = storeSnap.data()!;
    if (store.ownerUid !== request.auth.uid) throw new HttpsError('permission-denied', 'Not your store');

    const s = stripe(stripeSecretKey.value());

    let customerId: string = store.stripeCustomerId;
    if (!customerId) {
      const customer = await s.customers.create({
        email: store.email || undefined,
        metadata: { uid: request.auth.uid, storeId },
      });
      customerId = customer.id;
      await storeRef.update({ stripeCustomerId: customerId });
    }

    const session = await s.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: stripePriceId.value(), quantity: 1 }],
      success_url: `${returnUrl}?checkout=success`,
      cancel_url: `${returnUrl}?checkout=cancelled`,
      subscription_data: { metadata: { storeId } },
    });

    return { url: session.url };
  }
);

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

    const getStoreId = (obj: { metadata?: Stripe.Metadata | null }) =>
      obj.metadata?.storeId ?? null;

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const storeId = getStoreId(sub);
        if (storeId) {
          await db.collection('stores').doc(storeId).update({
            subscriptionStatus: sub.status,
            subscriptionId: sub.id,
            subscriptionEnd: admin.firestore.Timestamp.fromMillis(sub.current_period_end * 1000),
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const storeId = getStoreId(sub);
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
        const sub = typeof inv.subscription === 'string' ? null : inv.subscription as Stripe.Subscription | null;
        const storeId = sub ? getStoreId(sub) : null;
        if (storeId) {
          await db.collection('stores').doc(storeId).update({ subscriptionStatus: 'past_due' });
        }
        break;
      }
    }

    res.json({ received: true });
  }
);
