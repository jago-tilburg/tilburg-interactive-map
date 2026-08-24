const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
// Modular admin SDK (firebase-admin v13+ removed the old admin.firestore()
// namespace call — `admin.firestore` is now the /firestore submodule
// itself, not a callable getter — same modular-SDK direction the web/
// client already moved to).
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

setGlobalOptions({ region: 'europe-west1' });

async function requireAdmin(auth) {
  if (!auth) throw new HttpsError('unauthenticated', 'Login vereist.');
  const adminDoc = await db.collection('admins').doc(auth.uid).get();
  if (!adminDoc.exists) throw new HttpsError('permission-denied', 'Alleen admins mogen dit doen.');
}

async function getOwnedEvent(auth, eventId) {
  if (!auth) throw new HttpsError('unauthenticated', 'Login vereist.');
  const ref = db.collection('businessEvents').doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Evenement niet gevonden.');
  if (snap.data().ownerId !== auth.uid) throw new HttpsError('permission-denied', 'Dit is niet jouw evenement.');
  return ref;
}

// Server-authoritative event approval. Firestore rules deny direct client
// writes to `status`/`paid` on events — this is the only path that can set
// them, and only for a caller listed in the closed `admins` collection.
exports.approveEvent = onCall(async (request) => {
  await requireAdmin(request.auth);
  const { eventId } = request.data;
  if (!eventId) throw new HttpsError('invalid-argument', 'eventId ontbreekt.');
  await db.collection('businessEvents').doc(eventId).update({
    status: 'approved',
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: request.auth.uid,
  });
  return { ok: true };
});

exports.rejectEvent = onCall(async (request) => {
  await requireAdmin(request.auth);
  const { eventId, reason } = request.data;
  if (!eventId) throw new HttpsError('invalid-argument', 'eventId ontbreekt.');
  const update = {
    status: 'rejected',
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: request.auth.uid,
  };
  // Optional — an admin can still reject without typing one.
  if (reason && reason.trim()) update.rejectionReason = reason.trim();
  await db.collection('businessEvents').doc(eventId).update(update);
  return { ok: true };
});

// MOCK — stands in for a real Mollie/Stripe webhook, which needs API
// credentials this environment doesn't have. Deliberately still enforces
// the real security property the checklist cares about: `paid` can only be
// set here (server-side, ownership + approval-status checked), never by a
// raw client write to the event document. Swapping in a real payment
// provider later means replacing the body of this function, not the
// Firestore rules or the client-side contract that calls it.
exports.confirmEventPaymentStub = onCall(async (request) => {
  const ref = await getOwnedEvent(request.auth, request.data && request.data.eventId);
  const snap = await ref.get();
  if (snap.data().status !== 'approved') {
    throw new HttpsError('failed-precondition', 'Evenement moet eerst goedgekeurd zijn voordat je kunt betalen.');
  }
  await ref.update({
    paid: true,
    paidAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});
