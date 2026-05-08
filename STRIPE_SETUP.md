# Stripe Subscription Setup

Vendors get a 30-day free trial, then pay $50/month via the Stripe Payment Link already embedded in the app.

The Payment Link: `https://buy.stripe.com/aFa5kF5JZh193yT6OEd7q00`

When a vendor clicks Subscribe they are redirected to that link with `?client_reference_id={storeId}` appended. Stripe fires `checkout.session.completed` → the `stripeWebhook` Firebase Function updates Firestore.

---

## What needs to be deployed

Only two Firebase Functions are required:
- `stripeWebhook` — HTTP endpoint, listens for Stripe events
- `createPortalSession` — callable, opens the Stripe Billing Portal (manage/cancel)

No Stripe API key is needed for checkout — the Payment Link handles it.

---

## 1. Set Firebase secrets

You only need two secrets:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
# paste your Stripe secret key (sk_live_… or sk_test_…)
# Stripe Dashboard → Developers → API keys

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# leave blank for now — fill in after step 3
```

---

## 2. Deploy the functions

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

After deploying, note the URL for `stripeWebhook`:
```
https://<region>-<project-id>.cloudfunctions.net/stripeWebhook
```

---

## 3. Register the Stripe webhook

Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**:

- **Endpoint URL**: the `stripeWebhook` URL from step 2
- **Events to listen for**:
  - `checkout.session.completed`  ← fires when Payment Link is completed
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

After saving, click the endpoint → **Signing secret** → copy it.

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# paste the whsec_… signing secret
```

Redeploy:
```bash
firebase deploy --only functions
```

---

## 4. Configure Stripe Customer Portal (for Manage Billing)

Stripe Dashboard → **Settings** → **Billing** → **Customer portal** → enable it.

This lets active subscribers cancel or update their card via the "Manage" button.

---

## 5. Test the flow

1. Create a new vendor account — `trialEndsAt` is set to 30 days from now.
2. To test the paywall: in Firestore, set `trialEndsAt` to a past date and remove `subscriptionStatus`.
3. Click **Subscribe Now** — you'll be redirected to the Stripe Payment Link.
4. Use test card `4242 4242 4242 4242`, any future expiry, any CVC.
5. Stripe fires `checkout.session.completed` → webhook updates Firestore → paywall disappears.

---

## How it works

```
Store created  →  trialEndsAt = now + 30 days
                  subscriptionStatus = undefined

Trial expires  →  paywall shown in app

Vendor clicks Subscribe Now
       ↓
Redirected to:
  https://buy.stripe.com/aFa5kF5JZh193yT6OEd7q00?client_reference_id={storeId}
       ↓
Stripe Checkout collects card & creates subscription
       ↓
Stripe fires  checkout.session.completed
       ↓
stripeWebhook reads client_reference_id → finds store in Firestore
Updates:  subscriptionStatus = "active"
          subscriptionId = "sub_…"
          stripeCustomerId = "cus_…"
          subscriptionEnd = <period end>
       ↓
App re-renders, paywall gone ✓

Vendor cancels via Billing Portal
       ↓
Stripe fires  customer.subscription.deleted
       ↓
stripeWebhook: subscriptionStatus = "cancelled"
       ↓
Paywall shown on next load ✓
```

---

## Firestore fields on `stores` document

| Field | Type | Set by |
|---|---|---|
| `trialEndsAt` | Timestamp | App on store creation |
| `subscriptionStatus` | string (`active`, `past_due`, `cancelled`) | stripeWebhook |
| `subscriptionId` | string | stripeWebhook |
| `subscriptionEnd` | Timestamp | stripeWebhook |
| `stripeCustomerId` | string | stripeWebhook |

Firestore rules block vendors from writing these fields directly.
