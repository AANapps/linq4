// One-off admin script: pre-creates a vendor account + store so a client
// can log in immediately with no onboarding, email verification, or
// pending-approval step. Mirrors the doc shape written by
// handleOnboardingComplete() in src/App.tsx.
//
// Setup (once):
//   1. Firebase Console -> Project Settings -> Service Accounts -> Generate new private key
//   2. Save the downloaded JSON as functions/scripts/service-account.json
//      (already gitignored — never commit this file)
//
// Run (from functions/):
//   npx tsx scripts/create-vendor.ts
//
// Edit the `vendor` object below for each new client, then run again.

import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'service-account.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

// --- Edit these per client -------------------------------------------------
const vendor = {
  email: 'owner@example.com',
  password: 'TempPassword123!', // give this to the client; they can change it later in the app
  businessName: 'Example Cafe',
  category: 'Coffee', // must match one of the Category values in src/App.tsx
  cardType: 'stamp' as 'stamp' | 'spend' | 'visit',
  country: 'United Kingdom',
  companyNumber: '',
  phone: '',
  description: '',
  addrLine1: '',
  addrLine2: '',
  addrTown: '',
  addrState: '',
  addrPostcode: '',
};
// ----------------------------------------------------------------------------

async function main() {
  const userRecord = await auth.createUser({
    email: vendor.email,
    password: vendor.password,
    emailVerified: true,
    displayName: vendor.businessName,
  });
  const uid = userRecord.uid;

  await db.doc(`vendors/${uid}`).set({
    uid,
    name: vendor.businessName,
    email: vendor.email,
    photoURL: '',
    role: 'vendor',
    onboardingComplete: true,
    accountStatus: 'approved',
    country: vendor.country,
    companyNumber: vendor.companyNumber,
    privacyAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    vendorTermsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    total_cards_held: 0,
    totalStamps: 0,
    totalRedeemed: 0,
  });

  const isVisit = vendor.cardType === 'visit';
  const isSpend = vendor.cardType === 'spend';
  const address = [vendor.addrLine1, vendor.addrLine2, vendor.addrTown, vendor.addrState, vendor.addrPostcode]
    .filter(s => s.trim())
    .join(', ');

  const storeRef = await db.collection('stores').add({
    name: vendor.businessName,
    category: vendor.category,
    address,
    phone: vendor.phone,
    description: vendor.description,
    locations: [{
      id: 'primary', label: '',
      line1: vendor.addrLine1, line2: vendor.addrLine2,
      town: vendor.addrTown, state: vendor.addrState, postcode: vendor.addrPostcode,
    }],
    ownerUid: uid,
    isVerified: false,
    stamps_required_for_reward: 10,
    rewardsGiven: 0,
    cardEnabled: !isVisit && !isSpend,
    membershipEnabled: isVisit || isSpend,
    ...(isVisit ? { membershipType: 'visit', membershipStampsPerVisit: 1, scanMethod: 'qr' } : {}),
    ...(isSpend ? { membershipType: 'spend', membershipPointsRate: 1, membershipRedemptionRate: 100, scanMethod: 'qr' } : {}),
    trialEndsAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
  });

  console.log('Vendor account created:');
  console.log(`  uid:      ${uid}`);
  console.log(`  storeId:  ${storeRef.id}`);
  console.log(`  email:    ${vendor.email}`);
  console.log(`  password: ${vendor.password}`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
