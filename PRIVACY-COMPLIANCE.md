# Privacy & compliance record (internal, not user-facing)

Companion to `/voorwaarden` and `/privacybeleid` (the public-facing documents) and
`~/events-map-prototype/GO-LIVE-CHECKLIST.md` §7. This file is the internal record a Dutch AVG
audit or DPA (Autoriteit Persoonsgegevens) request would actually ask for — it isn't linked from
the app. Last updated 2026-09-03.

---

## 1. Data Processing Register (verwerkingsregister)

Required under AVG art. 30 once processing personal data at any real scale. This is the
processing-activity register; `/privacybeleid`'s table is the same information in user-facing form.

| Processing activity | Categories of data | Purpose | Legal basis | Retention | Recipients |
|---|---|---|---|---|---|
| Visitor account | Email, display name, hashed password (Firebase Auth) | Login, likes/ratings/reactions tied to account | Contract (6(1)(b)) | Until account deletion (self-service, immediate) | Firebase (processor) |
| Business/event-host profile | Organisation name, email | Publish/manage event listings | Contract | Until account deletion | Firebase |
| Marketing consent | Boolean + timestamp | Remember opt-in/out for future marketing email | Consent (6(1)(a)) | Until withdrawn or account deleted | Firebase |
| Shop interactions (likes/ratings/comments/reviews) | Account uid (if logged in) or anonymous local id; free-text content | Core product feature | Contract / legitimate interest (anonymous path) | Until shop or account deleted | Firebase RTDB |
| Event listings + photos | Title, location, dates, prices, photo | Publication on the map | Contract | Until event/business deleted | Firebase Firestore + Storage |
| Payment | Handled entirely by Stripe; 2happies stores only a Stripe session id + paid status | Event listing fee | Contract | Session id: until event deleted. Stripe's own records: per Stripe's retention (~7y, their legal obligation, not ours) | Stripe (processor) |
| Transactional email | Email address, template used | Verification, password reset, payment confirmation | Contract | Not stored beyond the send itself; delivery logs per Resend's retention | Resend (processor) |
| Hosting/access logs | IP address, request metadata | Security, abuse detection | Legitimate interest | Per Firebase/Google Cloud default log retention | Firebase (processor) |
| Product analytics (Google Analytics) | Pseudonymous usage events, no PII by design | Understand feature usage, funnel drop-off | Consent (6(1)(a)) — gated, see below | Per GA4 default (currently: not applicable, GA is not live) | Google (processor), **not yet live** |

**Data controller**: 2happies (see `/voorwaarden` for the legal entity — KVK/address/BTW numbers
still need to be filled in there before this register is complete for a real audit).

---

## 2. Data minimization review

Reviewed 2026-09-03 against what's actually collected vs. what's actually used:

- **Visitor email**: used for login + (optionally) marketing. Not currently used for anything
  else. No over-collection found.
- **Anonymous local id for unauthenticated likes/ratings**: this is *by design* the minimal
  option — it's not tied to any real identity at all, deliberately (see the architecture note in
  `tilburg-interactive-map`'s `firestore.rules`/`database.rules.json` history). Nothing to reduce
  here; it's already the minimal-data path.
- **Per-user rating history** (`userRatings: {userId, rating, createdAt}`): flagged in the
  original checklist wording as worth reviewing. Finding: this is necessary for the "one rating
  per user, can be updated" feature (`nextUserRating()` in `shopHelpers.ts`) — without it, a
  user's own rating couldn't be found and updated, only appended as a new one. Not over-collection
  for what the feature actually does; **no change recommended**.
- **IP address via hosting logs**: not something the application code collects explicitly — this
  is Firebase/Google Cloud's own infrastructure-level logging, standard for any hosted service and
  needed for abuse/security response. Not application-level over-collection.
- **Photo EXIF metadata**: confirmed already stripped by design — the client-side upload pipeline
  re-encodes every photo through `<canvas>.toBlob()` before it ever leaves the browser (drops all
  metadata by construction), and the server-side `sharp` processing never adds it back. GPS/device
  metadata from phone photos never reaches storage. No action needed, already correct.
- **Analytics event params**: reviewed the taxonomy added 2026-09-02/03 (see
  `~/events-map-prototype/GO-LIVE-CHECKLIST.md` §7) — every event fires with either no params or
  small categorical params (`filter_type`, `method`, `liked`, `kind`), never free-text user
  content, never an email or uid. No minimization concern once this goes live.

**Conclusion**: no over-collection found anywhere in the current schema. Nothing recommended for
removal.

---

## 3. Breach notification process (72-hour AVG requirement)

No formal incident has occurred. Process, to be followed if one does:

1. **Detection**: via Cloud Logging alerts (auth failures, admin action logs — see §6 of the
   go-live checklist), a report from a user/business, or a security researcher disclosure.
2. **Containment** (immediate): rotate any exposed credential (`firebase functions:secrets:set`
   + redeploy for Stripe/Resend keys; Firebase Console for API keys), revoke compromised sessions
   via Firebase Auth if applicable, disable the affected Cloud Function/rule path if the breach is
   ongoing.
3. **Assessment** (within 24h of detection): what data was exposed, how many people affected,
   whether it's a "high risk to rights and freedoms" under AVG art. 34 (triggers notifying
   affected individuals directly, not just the regulator).
4. **Notify the Autoriteit Persoonsgegevens** within 72 hours of becoming aware, via their online
   breach report form, if the breach poses *any* risk to individuals (the lower bar than art. 34's
   "high risk" — most breaches clear this bar).
5. **Notify affected individuals directly** (email, if their address is known) if the risk is
   assessed as high under art. 34.
6. **Post-incident**: root-cause writeup, fix, and a note added to this file's history.

**Open gap**: no single named person/role is designated as the one who actually executes this —
this is a one-person project today, so it defaults to the founder, but this should be written
down explicitly once there's a team, per the go-live checklist's "Incident response plan" item.

---

## 4. Data residency confirmation

Confirmed 2026-09-03 by checking actual deployed resource locations, not assumed:

- **Firestore**: `europe-west1` (staging project `tilburg-interactive-map-5710f`).
- **Firebase Storage**: `europe-west1` (deliberately chosen over the console's US default — see
  `~/events-map-prototype/GO-LIVE-CHECKLIST.md` §5's photo pipeline entry).
- **Cloud Functions**: `europe-west1`.
- **App Hosting (staging-next web app)**: `europe-west4`.
- **Realtime Database**: same project, EU region (inherited from the original prod project setup).
- **Firestore backups**: same region as the source database (`europe-west1`).

All application data storage is EU-resident. The only non-EU-controlled processing is whatever
Google/Stripe/Resend do internally as processors under their own DPAs (see §5 below) — standard
for any SaaS-backed stack, not something 2happies's own infra choices could avoid entirely.

---

## 5. Data Processing Agreement (DPA) checklist

| Vendor | Role | DPA status |
|---|---|---|
| Google Cloud / Firebase | Hosting, Auth, Firestore, RTDB, Storage, Functions | Google's standard Cloud Data Processing Addendum applies automatically to all Google Cloud/Firebase usage under the ToS — **verify it's been explicitly accepted in the Google Cloud / Firebase console (Google Cloud Terms → Data Processing and Security Terms)**, not just assumed. |
| Stripe | Payment processing | Stripe's DPA is incorporated into the Stripe Services Agreement by default for all Stripe accounts — no separate action typically needed, but **confirm the Stripe account's business details/DPA acceptance are current** (also relevant given the "Dronographics"-named account flagged in an earlier session as never explicitly confirmed as intentional for this project). |
| Resend | Transactional email | Resend publishes a standard DPA — **needs to be explicitly reviewed/accepted in the Resend dashboard** (not yet confirmed done). |
| Google Maps Platform | Map rendering, geocoding | Covered under the same Google Cloud terms as Firebase if using the same Google Cloud billing account; otherwise Google Maps Platform has its own terms — **confirm which applies**. |
| Google Analytics (not yet live) | Product analytics | Needs its own GA4 Data Processing Terms acceptance in the Analytics admin console **before** `NEXT_PUBLIC_GA_MEASUREMENT_ID` is ever set in production — add this to the go-live gate for that item. |

**Action needed from the account owner**: the three "verify/confirm" items above require logging
into each vendor's own console — not something checkable via code or CLI, needs a human with
account access to click through and confirm.

---

## 6. Third-party ToS/compliance quick reviews

- **Instagram embed** (shown on a shop's detail page if it has an Instagram link): Meta's
  embed requires disclosing the data call to Instagram/Meta in the privacy policy — **done**,
  `/privacybeleid` §5 lists it. No additional action found needed; this app doesn't use the
  Instagram API beyond the public oEmbed-style embed, no access token or user data shared with
  Meta beyond what the embed itself triggers in the visitor's browser.
- **Google Maps Platform ToS**: usage requires (a) proper attribution, which the Maps JS API
  renders automatically as part of the map tile itself — not something the app can accidentally
  omit; (b) the API key being genuinely used only for Maps Platform requests, confirmed by the
  existing referrer restriction work (§6 of the go-live checklist); (c) no scraping/caching of
  map tiles outside normal API usage, which this app doesn't do. No compliance gap found.
- **Accessibility legal requirement**: the EU Web Accessibility Directive applies to public-sector
  and public-sector-adjacent digital services — 2happies is a private commercial product, so it
  is **not legally required** to meet WCAG under that specific directive. Targeting WCAG 2.1 AA
  anyway remains good practice and is already substantially underway (focus traps, contrast
  fixes, `role="alert"` on form errors — see `~/events-map-prototype/GO-LIVE-CHECKLIST.md` §9's
  accessibility item, marked partial). No legal blocker either way.

---

## History

- 2026-09-03: Initial version, written as part of the broader §1/§7 legal-drafting pass alongside
  `/voorwaarden` and `/privacybeleid`.
