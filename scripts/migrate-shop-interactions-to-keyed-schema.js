#!/usr/bin/env node
/**
 * One-time migration: re-key each shop's likes/comments/userRatings/
 * userReviews from an array-at-parent-path to a keyed-child object, so
 * database.rules.json can grant `.write` at the individual $key level
 * instead of a blanket parent-level `true` (which let anyone wipe an
 * entire shop's comments/likes/ratings/reviews in one call).
 *
 *   likes:       ["u1", "u2"]              -> { u1: true, u2: true }
 *   comments:    [{id: 171..., ...}, ...]  -> { "171...": {id: 171..., ...}, ... }
 *   userReviews: [{id: 171..., ...}, ...]  -> { "171...": {id: 171..., ...}, ... }
 *   userRatings: [{userId: "u1", ...}, ...]-> { u1: {userId: "u1", ...}, ... }
 *
 * This is staging-only, same as scripts/migrate-shops-to-keyed-schema.js —
 * only ever targets --project tilburg-interactive-map-5710f, never prod.
 *
 * Run this BEFORE deploying the new database.rules.json / app code that
 * expect the keyed shape (or right alongside it) — the old app code reads
 * defensively (shopsSnapshotToArray handles both array and object shapes),
 * but writes from old code after this migration would re-introduce the
 * array shape for whatever it touches. Don't run the pre-migration
 * (staging-next Next.js) app against this project until this has run.
 *
 * Usage:
 *   node scripts/migrate-shop-interactions-to-keyed-schema.js --project <firebase-project-id> [--dry-run]
 *
 * Requires the Firebase CLI, authenticated (`firebase login`) with access
 * to the target project. Uses `firebase database:get`/`database:update`,
 * which run with the CLI user's own elevated access — not subject to
 * database.rules.json.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function parseArgs(argv) {
  const args = { project: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project") args.project = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
  }
  return args;
}

function firebase(args) {
  return execFileSync("firebase", args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 });
}

function toValueArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val.filter(Boolean) : Object.values(val).filter(Boolean);
}

// Returns null if this shop's four fields are already keyed-object shaped
// (idempotent: running this twice is a no-op the second time), otherwise
// the keyed replacement for each field that needs converting.
function keyedPatchForShop(shop) {
  const patch = {};
  let changed = false;

  const likes = shop.likes;
  if (Array.isArray(likes) && likes.length > 0) {
    patch.likes = Object.fromEntries(likes.map((userId) => [String(userId), true]));
    changed = true;
  }

  const comments = toValueArray(shop.comments);
  if (Array.isArray(shop.comments) && comments.length > 0) {
    patch.comments = Object.fromEntries(comments.map((c) => [String(c.id), c]));
    changed = true;
  }

  const userReviews = toValueArray(shop.userReviews);
  if (Array.isArray(shop.userReviews) && userReviews.length > 0) {
    patch.userReviews = Object.fromEntries(userReviews.map((r) => [String(r.id), r]));
    changed = true;
  }

  const userRatings = toValueArray(shop.userRatings);
  if (Array.isArray(shop.userRatings) && userRatings.length > 0) {
    patch.userRatings = Object.fromEntries(userRatings.map((r) => [String(r.userId), r]));
    changed = true;
  }

  return changed ? patch : null;
}

function main() {
  const { project, dryRun } = parseArgs(process.argv.slice(2));
  if (!project) {
    console.error("Usage: node migrate-shop-interactions-to-keyed-schema.js --project <firebase-project-id> [--dry-run]");
    process.exit(1);
  }

  console.log(`Fetching current shops from project "${project}"...`);
  const raw = firebase(["database:get", "/shops", "--project", project]);
  const current = JSON.parse(raw);

  if (current === null) {
    console.log("No data at /shops — nothing to migrate.");
    return;
  }

  const shops = Array.isArray(current) ? current.filter(Boolean) : Object.values(current).filter(Boolean);

  const perShopPatches = [];
  for (const shop of shops) {
    if (shop.id === undefined || shop.id === null) {
      throw new Error(`Shop missing an id, refusing to migrate: ${JSON.stringify(shop)}`);
    }
    const patch = keyedPatchForShop(shop);
    if (patch) perShopPatches.push({ shopId: shop.id, patch });
  }

  if (perShopPatches.length === 0) {
    console.log("All shops already keyed-object shaped — nothing to do.");
    return;
  }

  console.log(
    `${perShopPatches.length} of ${shops.length} shop(s) need re-keying: ${perShopPatches.map((p) => p.shopId).join(", ")}`,
  );

  if (dryRun) {
    console.log("--dry-run: not writing. Would apply these per-shop patches:");
    console.log(JSON.stringify(perShopPatches, null, 2));
    return;
  }

  for (const { shopId, patch } of perShopPatches) {
    const tmpFile = path.join(os.tmpdir(), `shop-${shopId}-interactions-patch-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(patch));
    console.log(`Updating shops/${shopId} (${Object.keys(patch).join(", ")})...`);
    firebase(["database:update", `/shops/${shopId}`, tmpFile, "--project", project, "--force"]);
    fs.unlinkSync(tmpFile);
  }

  console.log("Done. Verifying...");
  const after = JSON.parse(firebase(["database:get", "/shops", "--project", project]));
  const afterShops = Array.isArray(after) ? after.filter(Boolean) : Object.values(after).filter(Boolean);
  const stillArray = afterShops.filter((s) => keyedPatchForShop(s) !== null);
  if (stillArray.length > 0) {
    throw new Error(`Verification failed — still array-shaped: ${stillArray.map((s) => s.id).join(", ")}`);
  }
  console.log(`Verified: all ${afterShops.length} shop(s) now have keyed-object likes/comments/userRatings/userReviews.`);
}

main();
