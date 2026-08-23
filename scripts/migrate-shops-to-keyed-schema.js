#!/usr/bin/env node
/**
 * One-time migration: re-key the RTDB `shops` node from array-index keys
 * ("0", "1", "2", ...) to shop-id keys ("9001", "9002", ...).
 *
 * Why: the original app stored `shops` as a plain array and wrote likes/
 * comments/ratings/reviews to `shops/{arrayIndex}/...` using each shop's
 * *position* in the array, not its `id`. That's fragile — any reordering
 * of the array misattributes a like/comment to the wrong shop — and it's
 * incompatible with a clean per-shop-id data model. This script performs
 * a one-time, atomic re-key so every shop lives at `shops/{shop.id}`
 * instead, matching what web/src/lib/firebase/shops.ts now assumes.
 *
 * This is staging-only. tilburg-interactive-map (prod) is a completely
 * separate Firebase project/RTDB instance from tilburg-interactive-map-5710f
 * (staging) — this script never touches prod, and can't: it only ever
 * targets --project tilburg-interactive-map-5710f.
 *
 * IMPORTANT — read this before running against a project with real data:
 * the OLD vanilla-JS app (public/index.html, still what's deployed on the
 * `staging` branch) writes shops back with array-index keys whenever its
 * own admin add/edit/delete-shop, rating, like, or comment features are
 * used. Its *read* path is backward-compatible (it does
 * `Array.isArray(val) ? val : Object.values(val)`), but a write from the
 * old app after this migration will silently re-introduce array-indexed
 * keys and can misattribute data. Don't use the old site's shop-editing
 * features against this project until the new Next.js app's shop UI
 * replaces it.
 *
 * Usage:
 *   node scripts/migrate-shops-to-keyed-schema.js --project <firebase-project-id> [--dry-run]
 *
 * Requires the Firebase CLI to be installed and authenticated
 * (`firebase login`) with access to the target project. Uses
 * `firebase database:get`/`database:set`, which run with the CLI user's
 * own elevated access — not subject to database.rules.json — the same way
 * the Admin SDK would be.
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
  return execFileSync("firebase", args, { encoding: "utf8" });
}

function main() {
  const { project, dryRun } = parseArgs(process.argv.slice(2));
  if (!project) {
    console.error("Usage: node migrate-shops-to-keyed-schema.js --project <firebase-project-id> [--dry-run]");
    process.exit(1);
  }

  console.log(`Fetching current shops from project "${project}"...`);
  const raw = firebase(["database:get", "/shops", "--project", project]);
  const current = JSON.parse(raw);

  if (current === null) {
    console.log("No data at /shops — nothing to migrate.");
    return;
  }

  const shopList = Array.isArray(current) ? current.filter(Boolean) : Object.values(current).filter(Boolean);

  const rekeyed = {};
  const idCollisions = [];
  for (const shop of shopList) {
    if (shop.id === undefined || shop.id === null) {
      throw new Error(`Shop missing an id, refusing to migrate: ${JSON.stringify(shop)}`);
    }
    const key = String(shop.id);
    if (rekeyed[key]) idCollisions.push(key);
    rekeyed[key] = shop;
  }
  if (idCollisions.length > 0) {
    throw new Error(`Duplicate shop ids, refusing to migrate: ${idCollisions.join(", ")}`);
  }

  console.log(`Re-keying ${shopList.length} shop(s) by id: ${Object.keys(rekeyed).join(", ")}`);

  if (dryRun) {
    console.log("--dry-run: not writing. Would replace /shops with:");
    console.log(JSON.stringify(rekeyed, null, 2));
    return;
  }

  const tmpFile = path.join(os.tmpdir(), `shops-rekeyed-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(rekeyed));

  console.log("Writing re-keyed shops back to /shops (this replaces the whole node atomically)...");
  firebase(["database:set", "/shops", tmpFile, "--project", project, "--force"]);
  fs.unlinkSync(tmpFile);

  console.log("Done. Verifying...");
  const after = JSON.parse(firebase(["database:get", "/shops", "--project", project]));
  const afterKeys = Object.keys(after || {}).sort();
  const expectedKeys = Object.keys(rekeyed).sort();
  if (JSON.stringify(afterKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `Verification failed — expected keys [${expectedKeys.join(", ")}], got [${afterKeys.join(", ")}]`,
    );
  }
  console.log(`Verified: /shops now has ${afterKeys.length} shop(s) keyed by id: ${afterKeys.join(", ")}`);
}

main();
