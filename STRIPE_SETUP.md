# Stripe Subscription Setup

Vendors get a 30-day free trial, then pay $50/month. This is handled by:
- Firebase Functions (`functions/src/index.ts`) — `createCheckoutSession`, `createPortalSession`, `stripeWebhook`
- Stripe Checkout (hosted) — collects card details
- Stripe webhooks → Firestore updates (`subscriptionStatus` on the `stores` doc)

---

## 1. Create a Stripe account

Go to https://dashboard.stripe.com and create an account (or log in).

---

## 2. Create the $50/month product

1. Stripe Dashboard → **Products** → **Add product**
2. Name: "Linq Vendor Subscription"
3. Pricing: **Recurring**, $50.00 USD, **Monthly**
4. Save — copy the **Price ID** (starts with `price_…`)

---

## 3. Get your Stripe API keys

Stripe Dashboard → **Developers** → **API keys**:
- **Secret key** (`sk_live_…` or `sk_test_…` for testing)

---

## 4. Set Firebase secrets

In your project root, run:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
# paste your Stripe secret key when prompted

firebase functions:secrets:set STRIPE_PRICE_ID
# paste the price_… ID from step 2

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# leave blank for now — fill in after step 6
```

---

## 5. Deploy the functions

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

After deploying, note the URL for `stripeWebhook` — it looks like:
```
https://<region>-<project-id>.cloudfunctions.net/stripeWebhook
```

---

## 6. Register the Stripe webhook

Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**:

- **Endpoint URL**: the `stripeWebhook` URL from step 5
- **Events to listen for**:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

After saving, click the endpoint → **Signing secret** → copy it.

Then update the secret:
```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# paste the whsec_… signing secret
```

Redeploy functions to pick up the new secret:
```bash
firebase deploy --only functions
```

---

## 7. Configure the Stripe Customer Portal (optional but recommended)

Stripe Dashboard → **Settings** → **Billing** → **Customer portal** → enable it.
This lets vendors cancel or update their card via `handleManageBilling`.

---

## 8. Test the flow

1. Create a new vendor account in the app — `trialEndsAt` is set to 30 days from now.
2. To simulate trial expiry, manually set `trialEndsAt` to a past date in Firestore and clear `subscriptionStatus`.
3. The paywall should appear on the dashboard.
4. Click **Subscribe Now** — you should be redirected to Stripe Checkout.
5. Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.
6. After success, Stripe fires the webhook → Firestore `subscriptionStatus` becomes `"active"` → paywall disappears.

---

## How subscription status flows

```
Store created  →  trialEndsAt = now + 30 days
                  subscriptionStatus = undefined (in trial)

Trial expires  →  needsPayment = true  →  paywall shown

Vendor subscribes via Stripe Checkout
       ↓
Stripe fires  customer.subscription.created
       ↓
stripeWebhook updates Firestore:
  subscriptionStatus = "active"
  subscriptionId = "sub_…"
  subscriptionEnd = <current period end>
       ↓
App re-renders, paywall gone ✓

Vendor cancels via portal
       ↓
Stripe fires  customer.subscription.deleted
       ↓
stripeWebhook: subscriptionStatus = "cancelled"
       ↓
paywall shown again next login ✓
```

---

## Firestore fields on `stores` document

| Field | Type | Set by |
|---|---|---|
| `trialEndsAt` | Timestamp | App on store creation |
| `subscriptionStatus` | string (`active`, `trialing`, `past_due`, `cancelled`) | stripeWebhook function |
| `subscriptionId` | string | stripeWebhook function |
| `subscriptionEnd` | Timestamp | stripeWebhook function |
| `stripeCustomerId` | string | createCheckoutSession function |

Security rules prevent vendors from writing `subscriptionStatus`, `subscriptionId`, `subscriptionEnd`, or `stripeCustomerId` directly.
