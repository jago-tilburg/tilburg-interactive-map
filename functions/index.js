const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { setGlobalOptions } = require('firebase-functions/v2');
const { logger } = require('firebase-functions');
// Modular admin SDK (firebase-admin v13+ removed the old admin.firestore()
// namespace call — `admin.firestore` is now the /firestore submodule
// itself, not a callable getter — same modular-SDK direction the web/
// client already moved to).
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const sharp = require('sharp');

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

// Reactive moderation for a live event — an admin's only lever now that
// paying is what publishes an event (see confirmEventPaymentStub below),
// not a pre-publish approval step. Firestore rules never let a client set
// `status` to any of these values, only these functions can (Admin SDK
// bypasses rules). No precondition on the event's current status — the
// admin UI only exposes each action from the states where it makes sense.
exports.suspendEvent = onCall(async (request) => {
  await requireAdmin(request.auth);
  const { eventId, reason } = request.data || {};
  if (!eventId) throw new HttpsError('invalid-argument', 'eventId ontbreekt.');
  const update = {
    status: 'suspended',
    moderatedAt: FieldValue.serverTimestamp(),
    moderatedBy: request.auth.uid,
  };
  if (reason && reason.trim()) update.moderationReason = reason.trim();
  await db.collection('businessEvents').doc(eventId).update(update);
  return { ok: true };
});

// Reverses a suspension — the event goes back to 'approved' and becomes
// publicly visible again. Deliberately has no equivalent for 'blocked':
// block is meant to be the permanent action, restore only undoes suspend.
exports.restoreEvent = onCall(async (request) => {
  await requireAdmin(request.auth);
  const { eventId } = request.data || {};
  if (!eventId) throw new HttpsError('invalid-argument', 'eventId ontbreekt.');
  await db.collection('businessEvents').doc(eventId).update({ status: 'approved' });
  return { ok: true };
});

exports.blockEvent = onCall(async (request) => {
  await requireAdmin(request.auth);
  const { eventId, reason } = request.data || {};
  if (!eventId) throw new HttpsError('invalid-argument', 'eventId ontbreekt.');
  const update = {
    status: 'blocked',
    moderatedAt: FieldValue.serverTimestamp(),
    moderatedBy: request.auth.uid,
  };
  if (reason && reason.trim()) update.moderationReason = reason.trim();
  await db.collection('businessEvents').doc(eventId).update(update);
  return { ok: true };
});

// Admin-initiated delete, distinct from the client-side deleteBusinessEvent
// (Firestore rules only let the event's own owner delete it directly) — an
// admin moderating someone else's event needs a server-side path that
// doesn't depend on ownership. Permanent, unlike suspend.
exports.deleteEvent = onCall(async (request) => {
  await requireAdmin(request.auth);
  const { eventId } = request.data || {};
  if (!eventId) throw new HttpsError('invalid-argument', 'eventId ontbreekt.');
  await db.collection('businessEvents').doc(eventId).delete();
  return { ok: true };
});

// MOCK — stands in for a real Mollie/Stripe webhook, which needs API
// credentials this environment doesn't have. Deliberately still enforces
// the real security property the checklist cares about: `status`/`paid`
// can only be set here (server-side, ownership + current-status checked),
// never by a raw client write to the event document. Swapping in a real
// payment provider later means replacing the body of this function, not
// the Firestore rules or the client-side contract that calls it.
//
// This is also the event's actual publish trigger now — paying an event
// makes it live directly, no separate admin approval step in between.
// approveEvent/rejectEvent (and the pending-approval state they used to
// gate) are gone; suspendEvent/blockEvent above are the admin's lever now,
// applied reactively to something already live rather than proactively
// before it ever goes live.
exports.confirmEventPaymentStub = onCall(async (request) => {
  const ref = await getOwnedEvent(request.auth, request.data && request.data.eventId);
  const snap = await ref.get();
  if (snap.data().status !== 'pending') {
    throw new HttpsError('failed-precondition', 'Evenement kan niet worden betaald vanuit deze status.');
  }
  await ref.update({
    status: 'approved',
    paid: true,
    paidAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

// Only the three photo-bearing kinds storage.rules actually grants writes
// on — anything else in the bucket isn't this pipeline's to touch.
const PHOTO_PATH = /^(shops|businessEvents|umbrellaEvents)\/[^/]+\/[^/]+\.webp$/;
const THUMB_WIDTH = 480;
const DETAIL_WIDTH = 960;

// The derivative-suffix convention this function itself defines and owns —
// checked first, before any download/decode, so the function never
// re-triggers on its own writes (onObjectFinalized fires for every object
// write in the bucket, including these).
function isDerivative(name) {
  return name.endsWith('_thumb.webp') || name.endsWith('_detail.webp');
}

// Explicit bucket name rather than relying on Firebase's default-bucket
// derivation — this project's bucket uses the newer `.firebasestorage.app`
// naming (set up manually via the console this session, see storage.rules'
// history), not the legacy `.appspot.com` convention default derivation
// would produce, and an explicit name also means this trigger registers
// correctly without needing GCLOUD_PROJECT/FIREBASE_CONFIG at import time
// (matters for unit tests, which don't have a live Cloud Functions
// environment injecting those).
const PHOTO_BUCKET = 'tilburg-interactive-map-5710f.firebasestorage.app';

// Storage-triggered processing for shop/event photo uploads (GO-LIVE-
// CHECKLIST.md §5). Two things this does that the client pipeline can't:
// (1) byte-level validation — storage.rules' contentType check only
// inspects the client-asserted Content-Type header at upload time, not the
// actual bytes, so a direct Storage API call could forge `image/webp` on a
// non-image payload; sharp() throwing on decode is the real check, and a
// failure deletes the object rather than leaving a broken file live.
// (2) generates thumbnail/detail WebP derivatives for future consumption
// (map markers/detail views don't read these yet — that's a separate,
// deliberately deferred follow-up, same as orphan cleanup and the photoUrl
// backfill). EXIF stripping needs no extra work here: every original
// already went through the client's <canvas>.toBlob() re-encode, which
// drops all embedded metadata by browser design, and sharp's own output
// never embeds metadata unless .withMetadata() is called.
exports.processPhotoUpload = onObjectFinalized({ region: 'europe-west1', bucket: PHOTO_BUCKET }, async (event) => {
  const { bucket: bucketName, name, contentType } = event.data;
  if (isDerivative(name) || contentType !== 'image/webp' || !PHOTO_PATH.test(name)) return;

  const bucket = getStorage().bucket(bucketName);
  const file = bucket.file(name);
  const [buffer] = await file.download();

  let image;
  try {
    image = sharp(buffer);
    await image.metadata();
  } catch (err) {
    logger.warn(`processPhotoUpload: ${name} is not a decodable image, deleting`, { error: String(err) });
    await file.delete();
    return;
  }

  const base = name.slice(0, -'.webp'.length);
  await Promise.all([
    image
      .clone()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer()
      .then((buf) => bucket.file(`${base}_thumb.webp`).save(buf, { contentType: 'image/webp' })),
    image
      .clone()
      .resize({ width: DETAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer()
      .then((buf) => bucket.file(`${base}_detail.webp`).save(buf, { contentType: 'image/webp' })),
  ]);
});
