# Operations runbook (internal)

How the founder (or whoever's on duty) actually handles the recurring operational situations
this product creates. Companion to `PRIVACY-COMPLIANCE.md` (data/privacy-specific) and
`~/events-map-prototype/GO-LIVE-CHECKLIST.md` §3a/§4/§8. Last updated 2026-09-03.

---

## 1. Reports (§4) — response SLA

A report (event/shop/comment/review) lands in AdminPanel's "Meldingen" tab, `status: 'open'`.

- **Target response time**: within 48 hours of a report being filed, an admin reviews it and
  either resolves (content was fine, dismiss) or acts (suspend/block the content via the
  existing per-status controls in AdminPanel's businessEvents tab).
- Since events publish immediately on payment (no pre-publish approval anymore), a report is now
  the *only* moderation trigger — there's no separate "approve/reject a submission" step to also
  SLA.
- At solo-founder scale, this is a manual daily check of the Meldingen tab, not an automated
  queue/alerting system. Revisit once report volume makes that impractical.

## 2. Refund requests (§2)

Per `/voorwaarden` §5.4: no refund once an event is successfully published, except (a) a
platform-side technical failure (paid but never went live) or (b) a report was upheld against
content that didn't actually violate the ToS.

1. Request arrives via the contact email in `/voorwaarden`.
2. Verify against Firestore: find the `businessEvents` doc, confirm `paid: true`, check
   `stripeSessionId`.
3. If it qualifies (see above): issue the refund manually via the Stripe Dashboard (Payments →
   find the charge → Refund). No code path does this automatically today — not justified at
   current volume.
4. If it doesn't qualify: reply explaining the policy, pointing to `/voorwaarden` §5.4.

## 3. Takedown requests (§1/§4)

Someone (not necessarily the content's owner) claims content on 2happies violates their rights
(defamation, copyright on a photo, etc.).

1. If they used the in-app "Melden" button: it's already in AdminPanel's Meldingen tab — treat
   like any other report, but prioritize (rights claims are more time-sensitive than routine
   moderation).
2. If they emailed directly: manually look up the content (shop/event/comment/review id from
   their description), apply the same suspend/block primitives an admin report-response would use.
3. Document the decision (what was removed/kept and why) — there's no formal audit-log UI for
   this yet (see the go-live checklist's "audit log for admin actions" item, still partial), so
   for now this means a note wherever the requester's email is kept.

## 4. Inactive account policy (§3a)

**Not yet automated.** Policy, to implement when it becomes worth building:

- A business account with no login and no event activity for 12 months gets a warning email
  (via the existing Resend integration) before any action.
- No account is auto-deleted — inactivity alone is never destructive. This is a notice-only
  policy until there's an actual reason (storage cost, stale listings) to go further.
- **Not implemented in code** — no scheduled Cloud Function checks for this today. Flagging as a
  policy decision now so it's not silently skipped later, not claiming it's built.

## 5. Banning / removing abusive businesses, and appeals (§3a/§4)

The technical primitives already exist and are live: `suspendEvent` (reversible),
`blockEvent` (permanent), `deleteEvent` (admin-gated), and — at the account level — an admin can
manually disable a Firebase Auth user (Firebase Console) if an entire business account, not just
one event, needs to be stopped (no in-app "ban an account" button exists yet, only per-event
moderation).

**Appeal path**: reply-to the contact email in `/voorwaarden` or `/privacybeleid`. Manually
reviewed — no formal appeal-tracking system, same solo-founder-scale caveat as §1 above.

## 6. What happens to a paid, live event if the business account is deleted mid-run (§3a)

**Resolved as policy, documented in `/voorwaarden` §5.5**: deleting a business account (via
`deleteBusinessAccountReal`) deletes all its events too, including paid/live ones, with no
automatic refund for the remaining run — matches actual current code behavior exactly (this
wasn't a code change, just documenting what already happens). A business is warned of this via
the ToS; the delete-account UI itself doesn't currently show an extra confirmation naming this
specific consequence — **worth adding a specific warning string to the delete-account
confirmation dialog** (`ProfileShell.tsx`/`BusinessShell.tsx`) if this comes up as a real support
issue, not built tonight.

---

## 7. Disaster recovery — restoring Firestore or Realtime Database (§6)

**Firestore** — daily backups, 7-day retention (`gcloud firestore backups schedules list` to see
them). To restore: `gcloud firestore databases restore --source-backup=<backup-name>
--destination-database=<new-database-id>` — this always creates a **new**, separate database, it
never overwrites the live one in place. Point the app at the restored data by either (a)
temporarily repointing `NEXT_PUBLIC_FIREBASE_PROJECT_ID`'s Firestore calls at the new database id
(a config change, not a code change, since the SDK defaults to `(default)`), or (b) exporting the
restored database's collections and importing them into `(default)` if a full in-place recovery is
actually needed. Delete the temporary restored database once done — it's a second full copy of the
data and bills accordingly. A real restore was tested 2026-09-02 (see `GO-LIVE-CHECKLIST.md` §6):
took ~13 minutes end-to-end for the current (small) dataset size, and confirmed the restored
collections came back with correct, real documents intact, not just an empty/errored restore.

**Realtime Database** — no managed backup product exists for RTDB (unlike Firestore). Instead: a
scheduled Cloud Function (`backupRealtimeDatabase`, `functions/index.js`) runs daily at 03:00
Europe/Amsterdam, reads the entire RTDB tree via the Admin SDK, and writes it as one JSON file to
`gs://tilburg-interactive-map-5710f.firebasestorage.app/rtdb-backups/<timestamp>.json`. A GCS
lifecycle rule on that bucket auto-deletes anything under the `rtdb-backups/` prefix after 7 days,
matching Firestore's retention. An admin-only callable, `triggerRtdbBackup`, exists for an
on-demand backup before a risky manual RTDB change, without waiting for the schedule.

To restore: download the relevant JSON file (`gcloud storage cat
gs://.../rtdb-backups/<file>.json`) and write it back with the Admin SDK
(`getDatabase().ref('/').set(JSON.parse(fileContents))`) — **this replaces the entire tree**, so
only do this against the real database as a genuine last resort (data loss/corruption), and prefer
restoring into a temporary standalone Firebase project first to inspect/diff against current data
if there's any doubt about which backup to use. There is no "restore into a new database" option
the way Firestore has — RTDB is a single tree per project. **Verified 2026-09-03**: the backup
function itself was live-triggered against real staging data (all 68 real shops came back in the
resulting file) and the underlying Admin SDK read/write path against the real bucket was confirmed
working — the destructive restore-write itself was deliberately **not** tested against real data
(no safe way to rehearse "overwrite the entire live tree" without an actual second RTDB instance),
so treat the restore *procedure* as documented-but-unrehearsed, not fully proven end-to-end the way
the Firestore restore was.

---

## History

- 2026-09-03: Initial version, written alongside the ToS/privacy drafting pass.
- 2026-09-03: Added §7, RTDB backup/restore procedure, alongside the new `backupRealtimeDatabase`
  Cloud Function.
