#!/usr/bin/env node
/**
 * One-time reset of staging's accounts, ahead of the passwordless->password
 * login rework (see PLAN-INLOGGEN.md fase 0).
 *
 * Wipes every Auth user, visitor profile, business profile and
 * business-submitted event on staging EXCEPT the admin account(s), then
 * rebuilds two known test accounts with real passwords and seeded events.
 *
 * Why a wipe at all: the existing visitor accounts were created through the
 * email-magic-link flow and therefore have no password. Once login becomes
 * email+password they can't sign in at all, and testing the new screens
 * against accounts that cannot exist in the new model just manufactures
 * fake bugs. They're test data — they go.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS PRESERVED, AND WHY IT'S DISCOVERED RATHER THAN CONFIGURED
 *
 * The admin account is preserved. Admin-ness lives in Firestore at
 * `admins/{uid}` where the doc id IS the Auth uid, and firestore.rules has
 * `allow read, write: if false` on that collection — so if this script
 * deleted the admin Auth user, recreating it would produce a NEW uid, the
 * old admins doc would point at a dead one, and there'd be no client-side
 * way to fix it. Only another Admin SDK run could.
 *
 * So the preserve-list is read straight out of the `admins` collection
 * rather than passed in as a flag. Two reasons that matters:
 *   - It's keyed on uid, not email address. A typo in an --admin-email flag
 *     would silently delete the one account that's expensive to lose; a uid
 *     read from the source of truth can't be typo'd.
 *   - It can't drift. Add a second admin next year and this script keeps
 *     doing the right thing with no edit.
 * If `admins` comes back empty the script refuses to run — that almost
 * certainly means credentials/project are wrong, not that there are no
 * admins, and "wipe everything" is the worst possible response to a failed
 * read.
 *
 * ---------------------------------------------------------------------------
 * WHY THE DELETION ORDER IS LOAD-BEARING
 *
 * businessEvents are deleted FIRST, doc by doc, before the accounts.
 *
 * `cleanupBusinessEventPhotos` (functions/index.js) is an onDocumentDeleted
 * trigger — deleting an event doc is the ONLY thing that removes that
 * event's photos from Storage. Two consequences:
 *   - Don't bulk-delete the collection out from under the trigger, and
 *     don't skip it: the photos would be orphaned in Storage with nothing
 *     left to ever clean them up.
 *   - Don't delete the accounts first: ownerId is how we identify which
 *     events belong to a doomed account, and once the users are gone that
 *     link is unrecoverable.
 * The trigger is async and fires after this script exits; that's fine, it
 * doesn't need us. But it does mean Storage cleanup lags the run by a few
 * seconds — don't read an immediately-still-populated bucket as a failure.
 *
 * Events whose ownerId matches no surviving admin are deleted regardless of
 * whether that owner still exists as an Auth user, which also sweeps up
 * orphans left behind by earlier manual testing.
 *
 * ---------------------------------------------------------------------------
 * STAGING ONLY
 *
 * Hard-refuses any project id other than tilburg-interactive-map-5710f.
 * Prod is a separate project (tilburg-interactive-map) with real user data
 * and this script must never be pointed at it. Dry-run is the default; you
 * have to pass --execute to write anything.
 *
 * Usage:
 *   node scripts/reset-staging-accounts.js \
 *     --project tilburg-interactive-map-5710f \
 *     --visitor-email you+bezoeker@example.com \
 *     --owner-email you+owner@example.com \
 *     [--execute] [--yes]
 *
 * Both addresses must be inboxes you can actually open — the visitor account
 * is created with emailVerified:false specifically so the "confirm your
 * email" notice is visible while building it, and you'll want to click that
 * link for real at least once.
 *
 * Requires Application Default Credentials with access to the project:
 *   gcloud auth application-default login
 */

const path = require("path");
const readline = require("readline");
const crypto = require("crypto");
const { createRequire } = require("module");

const STAGING_PROJECT_ID = "tilburg-interactive-map-5710f";

// No package.json at the repo root, and this script is deliberately
// throwaway — so it borrows the Admin SDK that functions/ already depends on
// rather than introducing a second node_modules tree for one run.
//
// createRequire rooted at functions/package.json rather than a plain
// require() of an absolute node_modules path: firebase-admin v13+ dropped the
// old `admin.auth()` namespace in favour of subpath entrypoints
// ('firebase-admin/auth' etc. — see the note at functions/index.js:9), and
// Node only consults a package's "exports" map for bare specifiers. Handed an
// absolute path it would look for a literal auth.js on disk and fail.
let initializeApp, getAuth, getFirestore, FieldValue;
try {
  const fromFunctions = createRequire(path.join(__dirname, "..", "functions", "package.json"));
  ({ initializeApp } = fromFunctions("firebase-admin/app"));
  ({ getAuth } = fromFunctions("firebase-admin/auth"));
  ({ getFirestore, FieldValue } = fromFunctions("firebase-admin/firestore"));
} catch (err) {
  console.error(
    "Could not load firebase-admin from functions/node_modules.\n" +
      "Run `npm install` in functions/ first.\n\n" +
      String(err),
  );
  process.exit(1);
}

// Missing credentials surface as a raw NO_ADC_FOUND throw from deep inside
// google-gax's gRPC layer — outside this script's own promise chain, so
// main().catch() never sees it and Node just prints a stack trace and dies.
// For a script you run once, by hand, while doing something destructive, an
// unreadable crash is the wrong answer to the most likely first mistake.
function explainAndExit(err) {
  const msg = String(err && err.message ? err.message : err);
  if (/default credentials|NO_ADC_FOUND/i.test(msg)) {
    console.error(
      "\nNo Application Default Credentials found.\n\n" +
        "Authenticate first, then re-run this script:\n\n" +
        "  gcloud auth application-default login\n\n" +
        "The account you log in with needs access to " +
        STAGING_PROJECT_ID +
        ".\n",
    );
  } else {
    console.error("\nFailed:", err);
  }
  process.exit(1);
}
process.on("uncaughtException", explainAndExit);
process.on("unhandledRejection", explainAndExit);

function parseArgs(argv) {
  const args = {
    project: null,
    visitorEmail: null,
    ownerEmail: null,
    execute: false,
    yes: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project") args.project = argv[++i];
    else if (argv[i] === "--visitor-email") args.visitorEmail = argv[++i];
    else if (argv[i] === "--owner-email") args.ownerEmail = argv[++i];
    else if (argv[i] === "--execute") args.execute = true;
    else if (argv[i] === "--yes") args.yes = true;
    else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(1);
    }
  }
  return args;
}

// 20 chars of base64url from a CSPRNG. These get printed once at the end and
// are never stored anywhere by this script — copy them into your password
// manager when it prints them.
function generatePassword() {
  return crypto.randomBytes(15).toString("base64url");
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function listAllUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return answer.trim().toLowerCase() === "ja";
}

// The two accounts to rebuild. Note what's deliberately absent: an
// owner-WITHOUT-visitor-profile account. That state can't exist in the new
// model — every signed-in user gets a visitor profile and the business
// profile sits on top of it — so there's nothing to seed for it. If one ever
// shows up in the data, it's a bug, not a fixture.
function testAccountSpecs({ visitorEmail, ownerEmail }) {
  return [
    {
      key: "visitor",
      email: visitorEmail,
      displayName: "Test Bezoeker",
      // Left unverified on purpose: it's the only way the email-verification
      // notice is actually on screen while the feature is being built, which
      // is where you'd catch that `emailVerified` doesn't refresh by itself
      // when the link is clicked in another tab.
      emailVerified: false,
      business: null,
      events: [],
    },
    {
      key: "owner",
      email: ownerEmail,
      displayName: "Test Owner",
      emailVerified: true,
      business: {
        businessName: "Testcafé De Proef",
        defaultAddress: "Heuvel 1, Tilburg",
        defaultLat: 51.5555,
        defaultLng: 5.0913,
      },
      // An empty Insights tab proves nothing: with no events the stat cards
      // are all zero and the list is blank, so a broken query and a working
      // one look identical. One live event carries the LIVE badge and the
      // counters, one pending event carries the unpaid branch.
      events: [
        {
          title: "Proefavond met live muziek",
          category: "muziek",
          description: "Testevent — staat live en is betaald.",
          startDate: isoDate(daysFromNow(-1)),
          endDate: isoDate(daysFromNow(2)),
          startTime: "19:00",
          endTime: "23:30",
          address: "Heuvel 1, Tilburg",
          lat: 51.5555,
          lng: 5.0913,
          status: "approved",
          paid: true,
          views: 812,
          interest: 44,
          clicks: 210,
          shares: 61,
        },
        {
          title: "Nog niet betaald testevent",
          category: "eten",
          description: "Testevent — staat pending, nog niet betaald.",
          startDate: isoDate(daysFromNow(20)),
          endDate: isoDate(daysFromNow(20)),
          startTime: "12:00",
          endTime: "17:00",
          address: "Korte Heuvel 5, Tilburg",
          lat: 51.5561,
          lng: 5.0896,
          status: "pending",
          paid: false,
        },
      ],
    },
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.project !== STAGING_PROJECT_ID) {
    console.error(
      `Refusing to run.\n` +
        `  --project must be exactly "${STAGING_PROJECT_ID}" (staging).\n` +
        `  Got: ${args.project === null ? "(missing)" : `"${args.project}"`}\n` +
        `  Prod is a separate project and this script deletes accounts.`,
    );
    process.exit(1);
  }
  if (!args.visitorEmail || !args.ownerEmail) {
    console.error("Both --visitor-email and --owner-email are required.");
    process.exit(1);
  }
  if (args.visitorEmail.toLowerCase() === args.ownerEmail.toLowerCase()) {
    console.error(
      "--visitor-email and --owner-email must differ — one account can hold both\n" +
        "roles, which is exactly why you need a second one that holds only the\n" +
        "visitor role to test the 'create an event profile' branch.",
    );
    process.exit(1);
  }

  const app = initializeApp({ projectId: args.project });
  const auth = getAuth(app);
  const db = getFirestore(app);

  // ---- Discover what to preserve -----------------------------------------
  const adminsSnap = await db.collection("admins").get();
  const preservedUids = new Set(adminsSnap.docs.map((d) => d.id));
  if (preservedUids.size === 0) {
    console.error(
      "The `admins` collection is empty.\n" +
        "That almost certainly means the credentials or project are wrong rather\n" +
        "than that this project has no admins — and wiping every account is the\n" +
        "worst possible reaction to a failed read. Refusing to continue.",
    );
    process.exit(1);
  }

  // ---- Work out what would go --------------------------------------------
  const allUsers = await listAllUsers(auth);
  const doomedUsers = allUsers.filter((u) => !preservedUids.has(u.uid));

  const eventsSnap = await db.collection("businessEvents").get();
  const doomedEvents = eventsSnap.docs.filter((d) => !preservedUids.has(d.get("ownerId")));

  const visitorsSnap = await db.collection("visitors").get();
  const doomedVisitors = visitorsSnap.docs.filter((d) => !preservedUids.has(d.id));

  const businessesSnap = await db.collection("businesses").get();
  const doomedBusinesses = businessesSnap.docs.filter((d) => !preservedUids.has(d.id));

  const specs = testAccountSpecs(args);

  // ---- Report before touching anything -----------------------------------
  console.log(`\nProject: ${args.project}`);
  console.log(`Mode:    ${args.execute ? "EXECUTE — this will delete data" : "dry run (pass --execute to write)"}\n`);

  console.log(`Preserving ${preservedUids.size} admin account(s):`);
  for (const uid of preservedUids) {
    const u = allUsers.find((x) => x.uid === uid);
    console.log(`  keep  ${uid}  ${u ? u.email ?? "(no email)" : "(no matching Auth user!)"}`);
  }
  if ([...preservedUids].some((uid) => !allUsers.find((x) => x.uid === uid))) {
    console.log(
      `\n  NOTE: an admins/{uid} doc has no matching Auth user. That admin doc is\n` +
        `  already dangling — this script leaves it alone, but it won't grant\n` +
        `  anyone admin either.`,
    );
  }

  console.log(`\nWould delete:`);
  console.log(`  ${doomedEvents.length} businessEvents (doc by doc, so photo cleanup fires)`);
  console.log(`  ${doomedVisitors.length} visitors profiles`);
  console.log(`  ${doomedBusinesses.length} businesses profiles`);
  console.log(`  ${doomedUsers.length} Auth users`);
  for (const u of doomedUsers) console.log(`      ${u.uid}  ${u.email ?? "(no email)"}`);

  console.log(`\nWould then create:`);
  for (const s of specs) {
    console.log(
      `  ${s.email}  —  ${s.business ? "bezoeker + event owner" : "alleen bezoeker"}, ` +
        `emailVerified=${s.emailVerified}, ${s.events.length} event(s)`,
    );
  }

  console.log(
    `\nNot touched: the RTDB shops, umbrellaEvents, reports, and the admin\n` +
      `account(s) above.\n`,
  );

  if (!args.execute) {
    console.log("Dry run — nothing was changed.");
    return;
  }

  if (!args.yes) {
    const ok = await confirm(`Type "ja" to delete the above and rebuild the test accounts: `);
    if (!ok) {
      console.log("Aborted, nothing changed.");
      return;
    }
  }

  // ---- 1. Events first, doc by doc ---------------------------------------
  // Individually rather than batched: a batch delete still fires the
  // onDocumentDeleted trigger per doc, but doing it one at a time keeps the
  // failure mode legible (you know exactly which doc broke) and the volume
  // here is a handful of test rows, not a migration.
  console.log(`\nDeleting ${doomedEvents.length} businessEvents...`);
  for (const d of doomedEvents) {
    await d.ref.delete();
    console.log(`  deleted event ${d.id} (${d.get("title") ?? "untitled"})`);
  }

  // ---- 2. Profile docs ---------------------------------------------------
  console.log(`\nDeleting ${doomedVisitors.length} visitors + ${doomedBusinesses.length} businesses...`);
  for (const d of [...doomedVisitors, ...doomedBusinesses]) {
    await d.ref.delete();
  }

  // ---- 3. Auth users -----------------------------------------------------
  console.log(`\nDeleting ${doomedUsers.length} Auth users...`);
  for (let i = 0; i < doomedUsers.length; i += 1000) {
    const batch = doomedUsers.slice(i, i + 1000).map((u) => u.uid);
    const result = await auth.deleteUsers(batch);
    console.log(`  deleted ${result.successCount}, failed ${result.failureCount}`);
    for (const err of result.errors) {
      console.error(`  FAILED ${batch[err.index]}: ${err.error.message}`);
    }
  }

  // ---- 4. Rebuild the test accounts --------------------------------------
  console.log(`\nCreating test accounts...`);
  const created = [];
  for (const spec of specs) {
    const password = generatePassword();
    const user = await auth.createUser({
      email: spec.email,
      password,
      emailVerified: spec.emailVerified,
      displayName: spec.displayName,
    });

    // Written here rather than left to the app's own createVisitorProfile
    // fallback so the account is usable the moment this script finishes —
    // and so marketingConsent starts out ABSENT, which is what makes the
    // app treat this as a first login and show the onboarding step. Setting
    // it to false here would silently skip the very screen you want to test.
    await db.collection("visitors").doc(user.uid).set({
      email: spec.email,
      displayName: spec.displayName,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (spec.business) {
      await db.collection("businesses").doc(user.uid).set({
        businessName: spec.business.businessName,
        email: spec.email,
        createdAt: FieldValue.serverTimestamp(),
        defaultAddress: spec.business.defaultAddress,
        defaultLat: spec.business.defaultLat,
        defaultLng: spec.business.defaultLng,
      });
    }

    for (const ev of spec.events) {
      // status/paid are server-authoritative — firestore.rules forbids a
      // client from ever setting them (only stripeWebhook and the moderation
      // functions can). The Admin SDK bypasses rules, which is the only
      // reason a seeded already-live, already-paid event is possible at all.
      await db.collection("businessEvents").add({
        ...ev,
        ownerId: user.uid,
        createdAt: FieldValue.serverTimestamp(),
        ...(ev.paid ? { paidAt: FieldValue.serverTimestamp() } : {}),
      });
    }

    created.push({ ...spec, uid: user.uid, password });
    console.log(`  created ${spec.email} (${user.uid})`);
  }

  // ---- 5. Print the credentials once ------------------------------------
  console.log(`\n${"=".repeat(72)}`);
  console.log("TEST ACCOUNT CREDENTIALS — printed once, not stored anywhere.");
  console.log("Copy these into your password manager now.");
  console.log("=".repeat(72));
  for (const c of created) {
    console.log(`\n  ${c.business ? "bezoeker + event owner" : "alleen bezoeker"}`);
    console.log(`    email:      ${c.email}`);
    console.log(`    password:   ${c.password}`);
    console.log(`    uid:        ${c.uid}`);
    console.log(`    verified:   ${c.emailVerified}`);
  }
  console.log(`\n${"=".repeat(72)}`);
  console.log(
    "\nBoth accounts have no marketingConsent field yet, so the app should treat\n" +
      "the next sign-in as a first login and show the onboarding step.\n" +
      "\nStorage photo cleanup runs asynchronously in cleanupBusinessEventPhotos —\n" +
      "give it a few seconds before checking the bucket.\n",
  );
}

main().catch(explainAndExit);
