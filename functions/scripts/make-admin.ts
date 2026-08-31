// One-off admin script: flips an existing user's `role` field to 'admin'
// in their users/{uid} doc (same effect as the Admin Panel's admin toggle
// in src/App.tsx, but usable without being logged in as an admin already).
//
// Setup (once) — this project's org policy blocks downloadable service
// account keys, so we authenticate as your own Google identity instead:
//   1. Install the gcloud CLI if you don't have it:
//      https://cloud.google.com/sdk/docs/install
//   2. Run:  gcloud auth application-default login
//      (opens a browser login — needs Owner/Editor on the Firebase project,
//      which you have as the project creator)
//
// Run (from functions/):
//   npx tsx scripts/make-admin.ts

import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'gen-lang-client-0160052260';
// Named Firestore database this app actually uses (see firestoreDatabaseId
// in firebase-applet-config.json) — NOT the "(default)" database.
const FIRESTORE_DATABASE_ID = 'ai-studio-f5c71d39-b547-47ca-86f6-29605aeb6822';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: PROJECT_ID,
});

const auth = admin.auth();
const db = getFirestore(admin.app(), FIRESTORE_DATABASE_ID);

const EMAIL = 'info@joinlinq.app';

async function main() {
  const userRecord = await auth.getUserByEmail(EMAIL);
  const uid = userRecord.uid;

  const userDoc = await db.doc(`users/${uid}`).get();
  if (!userDoc.exists) {
    throw new Error(`No users/${uid} doc found for ${EMAIL} — they need a consumer profile (from onboarding) before they can be made admin via this path.`);
  }

  await db.doc(`users/${uid}`).set({ role: 'admin' }, { merge: true });

  console.log(`${EMAIL} (uid: ${uid}) is now an admin.`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
