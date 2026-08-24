import { afterEach, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { ref, get, set, remove } from "firebase/database";
import { getTestEnv } from "./testEnv.js";

// The one UID database.rules.json hardcodes as the legacy RTDB admin —
// distinct from the Firestore admins/{uid} collection.
const ADMIN_UID = "d6JhdOvQt0TYmnEwhhRTF1yRDxa2";
const OTHER_UID = "other-uid";

let testEnv;

beforeAll(async () => {
  testEnv = await getTestEnv();
});

afterEach(async () => {
  await testEnv.clearDatabase();
});

async function seed(path, value) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), path), value);
  });
}

describe("shops", () => {
  it("allows public, unauthenticated read", async () => {
    await seed("shops/shop1", { name: "Test Shop" });
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(get(ref(db, "shops/shop1")));
  });

  it("allows the hardcoded admin uid to write", async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID).database();
    await assertSucceeds(set(ref(db, "shops/shop1"), { name: "New Shop" }));
  });

  it("denies write by any other authenticated user", async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).database();
    await assertFails(set(ref(db, "shops/shop1"), { name: "hijacked" }));
  });

  it("denies write by an unauthenticated user", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, "shops/shop1"), { name: "hijacked" }));
  });

  it("allows anyone, even unauthenticated, to write userReviews (overrides the shop-level write restriction)", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "shops/shop1/userReviews/rev1"), { text: "Great!" }));
  });

  it("allows anyone to read/write userRatings", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "shops/shop1/userRatings"), { avg: 4.5 }));
    await assertSucceeds(get(ref(db, "shops/shop1/userRatings")));
  });

  it("allows anyone to write comments", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "shops/shop1/comments/c1"), { text: "Nice" }));
  });

  it("allows anyone to read/write likes", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "shops/shop1/likes"), { [OTHER_UID]: true }));
    await assertSucceeds(get(ref(db, "shops/shop1/likes")));
  });

  // The tests above only prove the intended positive case ("add your own
  // item"). RTDB rules apply to the whole subtree at the path they're
  // declared on — `.write:true` at shops/{id}/comments etc. grants
  // unrestricted write to that ENTIRE node, not just to a new child key.
  // These document the actual, broader blast radius that follows from that:
  // an unauthenticated caller can wipe or overwrite every OTHER user's
  // comments/likes/ratings/reviews on any shop in one call, not just add
  // their own. Security review finding (2026-08-24) — not yet remediated;
  // these are assertSucceeds because that's what the rules currently allow,
  // same convention as the userReviews test above documenting a known,
  // accepted-so-far tradeoff. Flip to assertFails once this is fixed by
  // scoping writes to $key-level ownership checks instead of a blanket
  // parent-level `true`.
  it("SECURITY FINDING: an unauthenticated user can wipe ALL comments on a shop, not just add their own", async () => {
    await seed("shops/shop1/comments/real-user-comment", { userId: "real-user", text: "genuine comment" });
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(remove(ref(db, "shops/shop1/comments")));
    const after = await get(ref(db, "shops/shop1/comments"));
    if (after.exists()) throw new Error("expected comments to be wiped, but data survived");
  });

  it("SECURITY FINDING: an unauthenticated user can wipe ALL likes on a shop", async () => {
    await seed("shops/shop1/likes", { "real-user": true });
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(remove(ref(db, "shops/shop1/likes")));
  });

  it("SECURITY FINDING: an unauthenticated user can wipe ALL userRatings on a shop", async () => {
    await seed("shops/shop1/userRatings", { "real-user": 5 });
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(remove(ref(db, "shops/shop1/userRatings")));
  });

  it("SECURITY FINDING: an unauthenticated user can wipe ALL userReviews on a shop", async () => {
    await seed("shops/shop1/userReviews", { "real-review": { text: "genuine review" } });
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(remove(ref(db, "shops/shop1/userReviews")));
  });
});

describe("data shape / type validation", () => {
  // FIXED (2026-08-25): comments/likes/userRatings/userReviews had zero
  // `.validate` clauses — pure access control, no shape enforcement at
  // all. Every client-side consumer assumes an object shape (e.g.
  // Object.values(comments) to render a list); nothing stopped a caller
  // from replacing that object with a raw string/number, which would
  // throw when real client code iterates it — a crash vector against
  // anyone who then views that shop. Added `.validate:
  // "!newData.exists() || newData.hasChildren()"` to all four — requires
  // any non-delete write to be a real container (object/array with at
  // least one entry), same shape the app itself always writes. Doesn't
  // touch the parent-write-grants-whole-subtree issue (still deferred,
  // see the commit that fixed requests/shopViews) — this only closes the
  // "wrong shape entirely" crash vector, independent of that.
  it("denies overwriting comments with a raw string", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, "shops/shop1/comments"), "not an object, breaks Object.values(comments) client-side"));
  });

  it("denies overwriting likes with a number", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, "shops/shop1/likes"), 12345));
  });

  it("denies overwriting userRatings with a boolean", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, "shops/shop1/userRatings"), true));
  });

  it("denies overwriting userReviews with a raw string", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, "shops/shop1/userReviews"), "not an object"));
  });

  it("still allows a legitimate object write to comments (the app's real write pattern)", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "shops/shop1/comments"), { c1: { userId: "u1", text: "Nice" } }));
  });

  it("still allows deleting (setting to null/empty, which RTDB treats as delete)", async () => {
    await seed("shops/shop1/comments", { c1: { userId: "u1", text: "Nice" } });
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(remove(ref(db, "shops/shop1/comments")));
  });

  it("still allows adding a single comment by key (the app's other real write path)", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "shops/shop1/comments/c1"), { userId: "u1", text: "Nice" }));
  });
});

describe("shopViews", () => {
  // FIXED (2026-08-25): no auth check at all is intentional and stays (view
  // tracking is anonymous-friendly by design, matching likes/comments) —
  // but there used to be no value constraint either, so any caller could
  // set a shop's view count to an arbitrary/negative/huge number instead
  // of incrementing it. Added a .validate requiring newData to be exactly
  // one more than the current value (or 1 if unset), matching exactly what
  // trackShopView() in shops.ts already does (read current, write
  // current+1) — legitimate behavior is unaffected, only a raw/forged
  // value is now rejected.
  it("allows public read", async () => {
    await seed("shopViews/shop1", 5);
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(get(ref(db, "shopViews/shop1")));
  });

  it("allows an unauthenticated caller to set the first view (1) when none exists yet", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "shopViews/shop1"), 1));
  });

  it("allows incrementing by exactly one from the current value", async () => {
    await seed("shopViews/shop1", 5);
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "shopViews/shop1"), 6));
  });

  it("denies setting an arbitrary/non-incremented value", async () => {
    await seed("shopViews/shop1", 5);
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, "shopViews/shop1"), 999999));
  });

  it("denies setting a negative value", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, "shopViews/shop1"), -999999));
  });

  it("denies skipping ahead by more than one", async () => {
    await seed("shopViews/shop1", 5);
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, "shopViews/shop1"), 7));
  });

  it("denies a non-numeric value", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, "shopViews/shop1"), "not-a-number"));
  });
});

describe("events (legacy RTDB, distinct from Firestore businessEvents)", () => {
  it("allows public, unauthenticated read", async () => {
    await seed("events/evt1", { title: "Legacy Event" });
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(get(ref(db, "events/evt1")));
  });

  it("allows the hardcoded admin uid to write", async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID).database();
    await assertSucceeds(set(ref(db, "events/evt1"), { title: "New Event" }));
  });

  it("denies write by a non-admin authenticated user", async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).database();
    await assertFails(set(ref(db, "events/evt1"), { title: "hijacked" }));
  });
});

describe("requests", () => {
  it("denies read by a non-admin authenticated user", async () => {
    await seed("requests/req1", { text: "please add my shop" });
    const db = testEnv.authenticatedContext(OTHER_UID).database();
    await assertFails(get(ref(db, "requests/req1")));
  });

  it("denies read by an unauthenticated user", async () => {
    await seed("requests/req1", { text: "please add my shop" });
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(get(ref(db, "requests/req1")));
  });

  it("allows the admin uid to read", async () => {
    await seed("requests/req1", { text: "please add my shop" });
    const db = testEnv.authenticatedContext(ADMIN_UID).database();
    await assertSucceeds(get(ref(db, "requests/req1")));
  });

  it("allows anyone, even unauthenticated, to write a request", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "requests/req1"), { text: "please add my shop" }));
  });

  // FIXED (2026-08-25): `.write:true` used to also sit at the requests/
  // parent node itself, which grants write to the WHOLE node, not just to
  // a caller's own new child — an unauthenticated user could wipe every
  // other pending request in one call. The app only ever wrote through
  // push()-generated child keys anyway (confirmed in requests.ts before
  // touching this), so removing the parent-level grant closes the gap
  // with zero change to real app behavior.
  it("denies an unauthenticated user from wiping the entire requests node", async () => {
    await seed("requests/someone-elses-request", { text: "a real pending request from someone else" });
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(remove(ref(db, "requests")));
  });

  // ALSO FIXED (2026-08-25): $requestId's own write grant used to be
  // unconditional `true` too, meaning anyone who knew (or, low-probability,
  // guessed) an existing request's push-generated key could delete it —
  // `deleteRequest()` is only ever called from AdminPanel.tsx, never from
  // any visitor-facing flow, so it should have been admin-only all along.
  // Creating a NEW request (the actual public flow, via push()) stays open
  // to everyone — this only closes deleting/overwriting an EXISTING one.
  it("denies a non-admin (even unauthenticated) from deleting an existing request by key", async () => {
    await seed("requests/req1", { text: "please add my shop" });
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(remove(ref(db, "requests/req1")));
  });

  it("allows the admin uid to delete an existing request by key", async () => {
    await seed("requests/req1", { text: "please add my shop" });
    const db = testEnv.authenticatedContext(ADMIN_UID).database();
    await assertSucceeds(remove(ref(db, "requests/req1")));
  });

  it("still allows anyone, even unauthenticated, to create a NEW request by a not-yet-existing key", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "requests/brand-new-key"), { text: "please add my shop" }));
  });
});

describe("appTexts", () => {
  it("allows public read", async () => {
    await seed("appTexts/welcome", "Welkom!");
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(get(ref(db, "appTexts/welcome")));
  });

  it("allows the admin uid to write", async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID).database();
    await assertSucceeds(set(ref(db, "appTexts/welcome"), "Welkom!"));
  });

  it("denies write by a non-admin authenticated user", async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).database();
    await assertFails(set(ref(db, "appTexts/welcome"), "hijacked"));
  });
});

describe("adminUsers", () => {
  it("allows public read", async () => {
    await seed("adminUsers", { [ADMIN_UID]: true });
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(get(ref(db, "adminUsers")));
  });

  it("allows the admin uid to write", async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID).database();
    await assertSucceeds(set(ref(db, "adminUsers"), { [ADMIN_UID]: true }));
  });

  it("denies write by a non-admin authenticated user", async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).database();
    await assertFails(set(ref(db, "adminUsers"), { [OTHER_UID]: true }));
  });
});
