const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { onValueDeleted } = require('firebase-functions/v2/database');
const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret, defineString } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const Stripe = require('stripe');
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

// Google Secret Manager-backed (the modern replacement for the old
// functions.config()) — values are set via `firebase functions:secrets:set
// STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, never committed or passed
// through chat. Only readable at runtime inside a function bound to them
// via `secrets: [...]` in its options, not at module load time.
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

// TEST-MODE PREPARATION — not live. Placeholder price for a single event
// listing; matches GO-LIVE-CHECKLIST.md §2's "current mock: flat €10/event
// fee" reference. The real business model (flat fee vs. subscription vs.
// commission) and the real price are still open decisions — this constant
// is the one place to change once that's settled, nothing else in this
// file needs to know the amount.
const EVENT_LISTING_PRICE_CENTS = 1000;

// Where Stripe Checkout redirects back to after success/cancel — the
// existing shareable-URL route (see MapExperience's initialSelection) that
// already opens the right event's detail modal directly. A deploy-time
// param (not a secret — this is public), defaulted to the current staging
// URL so it works out of the box; override with `--set-params` if the URL
// ever changes without needing a code change.
const appBaseUrl = defineString('APP_BASE_URL', {
  default: 'https://tilburg-2happies-staging-next--tilburg-interactive-map-5710f.europe-west4.hosted.app',
});

// Logs every failed admin/ownership check — the actual "auth failures"
// signal GO-LIVE-CHECKLIST.md §6 asks for. A single suspicious uid showing
// up repeatedly here (not just a one-off UI mis-click) is the thing worth
// alerting on; Cloud Logging is the natural home for that, no separate
// logging service needed for a project this size.
async function requireAdmin(auth) {
  if (!auth) {
    logger.warn('requireAdmin: denied — unauthenticated call');
    throw new HttpsError('unauthenticated', 'Login vereist.');
  }
  const adminDoc = await db.collection('admins').doc(auth.uid).get();
  if (!adminDoc.exists) {
    logger.warn('requireAdmin: denied — caller is not an admin', { uid: auth.uid });
    throw new HttpsError('permission-denied', 'Alleen admins mogen dit doen.');
  }
}

async function getOwnedEvent(auth, eventId) {
  if (!auth) {
    logger.warn('getOwnedEvent: denied — unauthenticated call', { eventId: eventId || null });
    throw new HttpsError('unauthenticated', 'Login vereist.');
  }
  const ref = db.collection('businessEvents').doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) {
    logger.warn('getOwnedEvent: denied — event not found', { eventId, uid: auth.uid });
    throw new HttpsError('not-found', 'Evenement niet gevonden.');
  }
  if (snap.data().ownerId !== auth.uid) {
    logger.warn('getOwnedEvent: denied — caller does not own this event', { eventId, uid: auth.uid });
    throw new HttpsError('permission-denied', 'Dit is niet jouw evenement.');
  }
  return ref;
}

// Reactive moderation for a live event — an admin's only lever now that
// paying is what publishes an event (see stripeWebhook below), not a
// pre-publish approval step. Firestore rules never let a client set
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
  logger.info('suspendEvent: event suspended', { eventId, adminUid: request.auth.uid, reason: update.moderationReason || null });
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
  logger.info('restoreEvent: event restored to approved', { eventId, adminUid: request.auth.uid });
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
  logger.info('blockEvent: event blocked', { eventId, adminUid: request.auth.uid, reason: update.moderationReason || null });
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
  logger.info('deleteEvent: event permanently deleted by admin', { eventId, adminUid: request.auth.uid });
  return { ok: true };
});

// Creates a Stripe Checkout Session for a single event listing — TEST-MODE
// PREPARATION, not live (see STRIPE_SECRET_KEY's own comment above). Still
// enforces the same security property the mock stub it replaces did:
// `status`/`paid` are only ever set server-side (here and in
// stripeWebhook below), never by a raw client write — see
// firestore.rules' businessEvents rules, which never grant either field.
// This function only *starts* the payment; stripeWebhook (below) is what
// actually marks the event paid, once Stripe confirms the money moved.
exports.createCheckoutSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const ref = await getOwnedEvent(request.auth, request.data && request.data.eventId);
  const snap = await ref.get();
  if (snap.data().status !== 'pending') {
    logger.warn('createCheckoutSession: rejected — event not in a payable state', {
      eventId: ref.id,
      uid: request.auth.uid,
      status: snap.data().status,
    });
    throw new HttpsError('failed-precondition', 'Evenement kan niet worden betaald vanuit deze status.');
  }

  const stripe = new Stripe(stripeSecretKey.value());
  const eventUrl = `${appBaseUrl.value()}/event/${ref.id}`;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    currency: 'eur',
    // card + ideal — this app's businesses are NL-based. iDEAL only
    // supports one-time payments, which already matches mode: 'payment'.
    payment_method_types: ['card', 'ideal'],
    // Stripe's own built-in coupon-code entry field on the Checkout page —
    // actual codes are created/managed in the Stripe Dashboard, nothing
    // here needs to know a code was used beyond the final charged amount.
    allow_promotion_codes: true,
    line_items: [
      {
        price_data: {
          currency: 'eur',
          unit_amount: EVENT_LISTING_PRICE_CENTS,
          product_data: { name: `Plaatsing: ${snap.data().title}` },
        },
        quantity: 1,
      },
    ],
    // The webhook trusts this, not anything the client sends directly —
    // getOwnedEvent above already verified this caller owns this event.
    metadata: { eventId: ref.id },
    success_url: `${eventUrl}?payment=success`,
    cancel_url: `${eventUrl}?payment=cancelled`,
  });

  logger.info('createCheckoutSession: session created', { eventId: ref.id, ownerUid: request.auth.uid, sessionId: session.id });
  return { url: session.url };
});

// Stripe posts here directly (no Firebase Auth context, hence onRequest
// rather than onCall) whenever a Checkout Session's status changes.
// req.rawBody (the exact bytes Stripe signed) is required for signature
// verification — a re-serialized JSON body would not match the signature
// even if semantically identical, which is why this can't be an onCall.
exports.stripeWebhook = onRequest({ secrets: [stripeWebhookSecret, stripeSecretKey] }, async (req, res) => {
  const stripe = new Stripe(stripeSecretKey.value());
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], stripeWebhookSecret.value());
  } catch (err) {
    logger.warn('stripeWebhook: signature verification failed', { message: err.message });
    res.status(400).send('Invalid signature');
    return;
  }

  if (event.type !== 'checkout.session.completed') {
    res.status(200).send('Ignored');
    return;
  }

  const session = event.data.object;
  const eventId = session.metadata && session.metadata.eventId;
  if (!eventId) {
    logger.warn('stripeWebhook: checkout.session.completed with no metadata.eventId', { sessionId: session.id });
    res.status(200).send('No eventId');
    return;
  }

  const ref = db.collection('businessEvents').doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) {
    logger.warn('stripeWebhook: event not found', { eventId, sessionId: session.id });
    res.status(200).send('Event not found');
    return;
  }
  // Idempotent — Stripe can and does redeliver webhooks (retries on a slow
  // response, duplicate delivery, etc.). Without this check, a redelivered
  // event would stamp a fresh paidAt over the real one.
  if (snap.data().paid === true) {
    logger.info('stripeWebhook: event already paid, ignoring redelivered webhook', { eventId, sessionId: session.id });
    res.status(200).send('Already paid');
    return;
  }

  await ref.update({
    status: 'approved',
    paid: true,
    paidAt: FieldValue.serverTimestamp(),
    stripeSessionId: session.id,
  });
  logger.info('stripeWebhook: event paid and published', { eventId, sessionId: session.id });
  res.status(200).send('OK');
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

// Best-effort — a deletion here failing left worse before this existed at
// all (the record delete already happened; the alternative to swallowing
// is an inconsistent partial-failure state, not a safer one), so this logs
// and moves on rather than propagating. Deletes by prefix rather than
// reconstructing exact filenames from the record's own photoUrl field —
// robust to the original plus both _thumb/_detail derivatives, and to a
// record whose photo upload partially failed and left an orphaned object
// the record itself never referenced.
async function deleteStorageDir(prefix) {
  try {
    await getStorage().bucket(PHOTO_BUCKET).deleteFiles({ prefix });
  } catch (err) {
    logger.warn(`deleteStorageDir: failed to delete ${prefix}`, { error: String(err) });
  }
}

// Deleting a shop must also delete its Storage object(s) — otherwise every
// deletion leaves billed storage behind forever. onValueDeleted fires only
// when the value at the referenced path itself becomes null, i.e. the
// whole shop node is gone, not on a child-level delete (removing a single
// comment/like doesn't delete `/shops/{shopId}` itself, so this can't
// misfire on the RTDB shops migration's per-key writes).
exports.cleanupShopPhotos = onValueDeleted(
  { ref: '/shops/{shopId}', instance: 'tilburg-interactive-map-5710f-default-rtdb' },
  async (event) => {
    await deleteStorageDir(`shops/${event.params.shopId}/`);
  },
);

exports.cleanupBusinessEventPhotos = onDocumentDeleted('businessEvents/{eventId}', async (event) => {
  await deleteStorageDir(`businessEvents/${event.params.eventId}/`);
});

exports.cleanupUmbrellaEventPhotos = onDocumentDeleted('umbrellaEvents/{umbrellaId}', async (event) => {
  await deleteStorageDir(`umbrellaEvents/${event.params.umbrellaId}/`);
});
