const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { onValueDeleted } = require('firebase-functions/v2/database');
const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret, defineString } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const Stripe = require('stripe');
const { Resend } = require('resend');
// Modular admin SDK (firebase-admin v13+ removed the old admin.firestore()
// namespace call — `admin.firestore` is now the /firestore submodule
// itself, not a callable getter — same modular-SDK direction the web/
// client already moved to).
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getDatabase } = require('firebase-admin/database');
const { getAuth } = require('firebase-admin/auth');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

initializeApp();
const db = getFirestore();
const rtdb = getDatabase();

setGlobalOptions({ region: 'europe-west1' });

// Google Secret Manager-backed (the modern replacement for the old
// functions.config()) — values are set via `firebase functions:secrets:set
// STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, never committed or passed
// through chat. Only readable at runtime inside a function bound to them
// via `secrets: [...]` in its options, not at module load time.
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const resendApiKey = defineSecret('RESEND_API_KEY');

// Resend's own shared sandbox address — works with zero setup, but Resend
// only actually delivers sends from this address to the account owner's own
// verified email, not real recipients. Swap this for a real
// no-reply@2happies.nl (or similar) once that domain is verified in Resend;
// nothing else in the send call sites needs to change.
const EMAIL_FROM = 'onboarding@resend.dev';

// Never throws — every call site treats a failed send as non-fatal (the
// underlying action — payment recorded, report filed — already succeeded;
// losing the notification email shouldn't roll that back or fail the
// request). Callers still get a log line to notice a broken integration.
async function sendEmail(apiKey, { to, subject, html }) {
  const resend = new Resend(apiKey);
  try {
    const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
    if (error) {
      logger.error('sendEmail: Resend returned an error', { to, subject, error: error.message });
      return null;
    }
    logger.info('sendEmail: sent', { to, subject, id: data?.id });
    return data;
  } catch (err) {
    logger.error('sendEmail: threw', { to, subject, message: err.message });
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Dutch long-form date/time strings matching the template's own copy style
// ("zaterdag 12 september", "2 september 2026, 14:12") — no client-side
// date-formatting helper is reusable here since these run in Cloud
// Functions, not the browser.
function formatDutchWeekdayDate(date) {
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}
function formatDutchLongDate(date) {
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
function formatDutchDateTime(date) {
  const time = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(date);
  return `${formatDutchLongDate(date)}, ${time}`;
}

// Real, hand-built HTML email templates (Outlook VML button/gradient
// fallbacks, dark-mode via prefers-color-scheme, hidden preheader text,
// mobile column-stacking) — not generated here. See functions/emails/ —
// each file was derived from a reference design the user supplied, with
// its example content replaced by {{token}} placeholders and its optional
// sections wrapped in <!--IF:name--> / <!--ENDIF:name--> markers.
const templateCache = new Map();
function renderEmailTemplate(filename, vars, conditionals = {}) {
  let html = templateCache.get(filename);
  if (!html) {
    html = fs.readFileSync(path.join(__dirname, 'emails', filename), 'utf8');
    templateCache.set(filename, html);
  }

  for (const [name, keep] of Object.entries(conditionals)) {
    const re = new RegExp(`<!--IF:${name}-->([\\s\\S]*?)<!--ENDIF:${name}-->`, 'g');
    html = html.replace(re, keep ? '$1' : '');
  }

  for (const [key, value] of Object.entries(vars)) {
    html = html.split(`{{${key}}}`).join(value ?? '');
  }

  return html;
}

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

const REPORT_CONTENT_TYPE_LABELS = {
  shop: 'shop',
  businessEvent: 'event',
  umbrellaEvent: 'festival',
  comment: 'reactie',
  review: 'review',
  shopPhoto: 'foto',
  eventPhoto: 'foto',
};

const REPORT_REASON_LABELS = {
  spam: 'Spam',
  offensive: 'Ongepaste taal',
  incorrect_info: 'Onjuiste informatie',
  other: 'Overig',
};

// Best-effort human-readable title + deep link for whatever got reported —
// shops live on RTDB, everything else on Firestore. A comment/review has no
// content of its own worth naming, so this names the shop it's attached to
// instead (comments/reviews only ever attach to shops in this app).
async function resolveReportedContent(contentType, contentId, parentId) {
  try {
    if (contentType === 'businessEvent') {
      const snap = await db.collection('businessEvents').doc(contentId).get();
      return { title: snap.exists ? snap.data().title : contentId, url: `${appBaseUrl.value()}/event/${contentId}` };
    }
    if (contentType === 'umbrellaEvent') {
      const snap = await db.collection('umbrellaEvents').doc(contentId).get();
      return { title: snap.exists ? snap.data().title : contentId, url: `${appBaseUrl.value()}/umbrella/${contentId}` };
    }
    if (contentType === 'shop') {
      const snap = await rtdb.ref(`shops/${contentId}/name`).once('value');
      return { title: snap.exists() ? snap.val() : contentId, url: `${appBaseUrl.value()}/shop/${contentId}` };
    }
    if ((contentType === 'comment' || contentType === 'review') && parentId) {
      const snap = await rtdb.ref(`shops/${parentId}/name`).once('value');
      const shopName = snap.exists() ? snap.val() : parentId;
      const label = contentType === 'review' ? 'Review' : 'Reactie';
      return { title: `${label} op ${shopName}`, url: `${appBaseUrl.value()}/shop/${parentId}` };
    }
  } catch (err) {
    logger.warn('resolveReportedContent: lookup failed', { contentType, contentId, message: err.message });
  }
  return { title: `${contentType} (${contentId})`, url: appBaseUrl.value() };
}

// Only businessEvents have a real owner in this app — shops are
// admin-curated (no per-shop owner concept at all), and comment/review
// posters are just an anonymous local id with no real name/email to show.
async function resolveContentOwner(contentType, contentId) {
  if (contentType !== 'businessEvent') return null;
  const eventSnap = await db.collection('businessEvents').doc(contentId).get();
  if (!eventSnap.exists) return null;
  const businessSnap = await db.collection('businesses').doc(eventSnap.data().ownerId).get();
  if (!businessSnap.exists) return null;
  const { businessName, email } = businessSnap.data();
  return [businessName, email].filter(Boolean).join(' · ');
}

// The reporter may be a real signed-in visitor (reporterId is their uid) or
// just an anonymous local id (getAnonUserId(), no Firestore doc at all) —
// resolve to a real name when we can, otherwise show the id honestly rather
// than fabricate a name/email that doesn't exist.
async function resolveReporter(reporterId) {
  const visitorSnap = await db.collection('visitors').doc(reporterId).get();
  if (visitorSnap.exists) {
    const { displayName, email } = visitorSnap.data();
    return [displayName, email].filter(Boolean).join(' · ');
  }
  return `${reporterId} (niet ingelogd)`;
}

// Reports are created directly by the client (setDoc, no callable in the
// path) — a Firestore trigger is what actually notices a new one, rather
// than relying on every report-creation call site to remember to also
// notify admins itself.
exports.notifyAdminsOfNewReport = onDocumentCreated(
  { document: 'reports/{reportId}', secrets: [resendApiKey] },
  async (event) => {
    const report = event.data.data();
    const reportId = event.params.reportId;
    const adminsSnap = await db.collection('admins').get();
    const toEmails = adminsSnap.docs.map((d) => d.data().email).filter(Boolean);
    if (toEmails.length === 0) {
      logger.warn('notifyAdminsOfNewReport: no admin emails found, skipping', { reportId });
      return;
    }

    const [content, owner, reporter, priorReportsSnap] = await Promise.all([
      resolveReportedContent(report.contentType, report.contentId, report.parentId),
      resolveContentOwner(report.contentType, report.contentId),
      resolveReporter(report.reporterId),
      db.collection('reports')
        .where('contentType', '==', report.contentType)
        .where('contentId', '==', report.contentId)
        .get(),
    ]);
    // -1: that query includes the just-created report itself — "Eerder
    // gemeld" (previously reported) means every OTHER report on file.
    const priorReportCount = Math.max(0, priorReportsSnap.size - 1);

    const reportedAt = report.createdAt && typeof report.createdAt.toDate === 'function'
      ? report.createdAt.toDate()
      : new Date();
    const contentTypeLabel = REPORT_CONTENT_TYPE_LABELS[report.contentType] || report.contentType;
    const reasonLabel = REPORT_REASON_LABELS[report.reason] || report.reason;

    await sendEmail(resendApiKey.value(), {
      to: toEmails,
      subject: `Nieuwe melding #${reportId} · ${contentTypeLabel}`,
      html: renderEmailTemplate(
        'report-notification.html',
        {
          content_type: escapeHtml(contentTypeLabel),
          content_titel: escapeHtml(content.title),
          reden: escapeHtml(reasonLabel),
          melding_id: reportId,
          site_url: appBaseUrl.value(),
          melding_tijdstip: escapeHtml(formatDutchDateTime(reportedAt)),
          content_url: content.url,
          eigenaar: owner ? escapeHtml(owner) : '',
          melder: escapeHtml(reporter),
          aantal_meldingen: String(priorReportCount),
          toelichting: report.details ? escapeHtml(report.details) : '',
          moderatie_url: appBaseUrl.value(),
          admin_url: appBaseUrl.value(),
          meldingen_url: appBaseUrl.value(),
          voorkeuren_url: appBaseUrl.value(),
          jaar: String(new Date().getFullYear()),
        },
        { eigenaar: !!owner, toelichting: !!report.details },
      ),
    });
    logger.info('notifyAdminsOfNewReport: notified admins', { reportId, adminCount: toEmails.length });
  },
);

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
exports.stripeWebhook = onRequest({ secrets: [stripeWebhookSecret, stripeSecretKey, resendApiKey] }, async (req, res) => {
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

  // Best-effort — a failed confirmation email must never turn a real,
  // already-processed payment into an HTTP error Stripe would retry.
  const eventData = snap.data();
  const businessSnap = await db.collection('businesses').doc(eventData.ownerId).get();
  const toEmail = businessSnap.exists ? businessSnap.data().email : null;
  if (toEmail) {
    const eventUrl = `${appBaseUrl.value()}/event/${eventId}`;
    const dashboardUrl = `${appBaseUrl.value()}/eventbeheer`;
    const startDate = new Date(`${eventData.startDate}T00:00:00`);
    const endDate = new Date(`${eventData.endDate}T00:00:00`);
    await sendEmail(resendApiKey.value(), {
      to: toEmail,
      subject: `Tilburg ziet nu jouw event!`,
      html: renderEmailTemplate(
        'payment-confirmation.html',
        {
          event_naam: escapeHtml(eventData.title),
          site_url: appBaseUrl.value(),
          // The original, not a resized derivative — that swap
          // (photoVariantUrl) is web/-only client logic, not worth porting
          // here for a once-per-send email image.
          event_afbeelding_url: eventData.photoUrl || '',
          event_datum: escapeHtml(formatDutchWeekdayDate(startDate)),
          event_tijd: escapeHtml(`${eventData.startTime}–${eventData.endTime}`),
          event_locatie: escapeHtml(eventData.address),
          listing_einddatum: escapeHtml(formatDutchLongDate(endDate)),
          event_url: eventUrl,
          bedrag: (EVENT_LISTING_PRICE_CENTS / 100).toFixed(2).replace('.', ','),
          betaaldatum: escapeHtml(formatDutchDateTime(new Date())),
          betaalmethode: 'Stripe',
          stripe_referentie: session.id,
          dashboard_inzicht_url: dashboardUrl,
          event_bewerken_url: dashboardUrl,
          dashboard_url: dashboardUrl,
          help_url: appBaseUrl.value(),
          jaar: String(new Date().getFullYear()),
        },
        { eventFoto: !!eventData.photoUrl },
      ),
    });
  } else {
    logger.warn('stripeWebhook: no business email found, confirmation email skipped', { eventId, ownerId: eventData.ownerId });
  }

  res.status(200).send('OK');
});

// Replaces the Auth client SDK's own sendEmailVerification()/
// sendPasswordResetEmail() (which mail from Firebase's own sender, not
// Resend/our template) — generateEmailVerificationLink/
// generatePasswordResetLink still produce a real Firebase Auth action link
// (verified via the default Firebase-hosted action handler, unchanged),
// only the email itself is now ours to send and brand.
exports.sendVerificationEmail = onCall({ secrets: [resendApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Log in om je e-mailadres te bevestigen.');
  }

  const userRecord = await getAuth().getUser(request.auth.uid);
  if (userRecord.emailVerified) {
    return { ok: true, alreadyVerified: true };
  }
  if (!userRecord.email) {
    throw new HttpsError('failed-precondition', 'Dit account heeft geen e-mailadres.');
  }

  const link = await getAuth().generateEmailVerificationLink(userRecord.email);
  const sent = await sendEmail(resendApiKey.value(), {
    to: userRecord.email,
    subject: 'Bevestig je e-mailadres',
    html: renderEmailTemplate('base.html', {
      email_titel: 'Bevestig je e-mailadres — 2happies',
      preheader_tekst: 'Klik op de knop om te bevestigen dat dit jouw e-mailadres is.',
      site_url: appBaseUrl.value(),
      badge_tekst: 'E-mailverificatie',
      titel: 'Bevestig je e-mailadres',
      intro_tekst:
        'Welkom bij 2happies! Klik op de knop hieronder om te bevestigen dat dit jouw e-mailadres is.',
      regel_label: 'E-mailadres',
      regel_waarde: escapeHtml(userRecord.email),
      cta_url: link,
      cta_tekst: 'Bevestig e-mailadres',
      afsluit_tekst: 'Heb je dit niet aangevraagd? Dan kun je deze e-mail gewoon negeren.',
      help_url: appBaseUrl.value(),
      voorkeuren_url: appBaseUrl.value(),
      jaar: String(new Date().getFullYear()),
    }),
  });

  if (!sent) {
    throw new HttpsError('internal', 'Verzenden van de verificatiemail is mislukt.');
  }
  return { ok: true };
});

// Deliberately never distinguishes "no such account" from "email sent" in
// its response or timing — same anti-enumeration reasoning the old client
// SDK call already relied on (see AuthModal.tsx's handleForgot), now this
// function's job to preserve instead of Firebase's.
exports.sendPasswordResetEmail = onCall({ secrets: [resendApiKey] }, async (request) => {
  const email = request.data?.email;
  if (typeof email !== 'string' || !email.trim()) {
    throw new HttpsError('invalid-argument', 'E-mailadres is verplicht.');
  }

  let link;
  try {
    link = await getAuth().generatePasswordResetLink(email);
  } catch (err) {
    logger.info('sendPasswordResetEmail: no link generated, treating as a no-op', {
      code: err.code,
      message: err.message,
    });
    return { ok: true };
  }

  await sendEmail(resendApiKey.value(), {
    to: email,
    subject: 'Wachtwoord opnieuw instellen',
    html: renderEmailTemplate('base.html', {
      email_titel: 'Wachtwoord opnieuw instellen — 2happies',
      preheader_tekst: 'Stel een nieuw wachtwoord in voor je 2happies-account.',
      site_url: appBaseUrl.value(),
      badge_tekst: 'Wachtwoord resetten',
      titel: 'Wachtwoord opnieuw instellen',
      intro_tekst:
        'We hebben een verzoek ontvangen om het wachtwoord van je 2happies-account opnieuw in te stellen. Klik op de knop hieronder om een nieuw wachtwoord te kiezen.',
      regel_label: 'Account',
      regel_waarde: escapeHtml(email),
      cta_url: link,
      cta_tekst: 'Stel nieuw wachtwoord in',
      afsluit_tekst: 'Was jij dit niet? Dan kun je deze e-mail negeren — je wachtwoord blijft ongewijzigd.',
      help_url: appBaseUrl.value(),
      voorkeuren_url: appBaseUrl.value(),
      jaar: String(new Date().getFullYear()),
    }),
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
