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
  // SECURITY FINDING (2026-08-24): database.rules.json has zero `.validate`
  // clauses anywhere — RTDB rules here are pure access control, no shape or
  // type enforcement at all. Every client-side consumer of these paths
  // assumes an object shape (e.g. Object.values(comments) to render a
  // list); nothing stops a caller from replacing that object with a raw
  // string/number/array, which would throw when real client code iterates
  // it — a crash/DoS vector against anyone who then views that shop, not
  // just the attacker. Not yet remediated.
  it("SECURITY FINDING: comments can be overwritten with a raw string instead of an object of comment entries", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "shops/shop1/comments"), "not an object, breaks Object.values(comments) client-side"));
  });
});

describe("shopViews", () => {
  // SECURITY FINDING (2026-08-24): no auth check at all, and no value
  // constraint — any unauthenticated caller can set a shop's view count to
  // an arbitrary number (including negative/huge), not just increment it.
  it("allows public read and public write (unauthenticated, unconstrained value)", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "shopViews/shop1"), 1));
    await assertSucceeds(set(ref(db, "shopViews/shop1"), -999999));
    await assertSucceeds(get(ref(db, "shopViews/shop1")));
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

  // SECURITY FINDING (2026-08-24): `.write:true` at the requests/ parent
  // node grants write to the whole node, not just to a caller's own new
  // child. An unauthenticated user can wipe every OTHER pending request in
  // one call, not just submit their own. Not yet remediated — flip to
  // assertFails once requests get per-submission ownership scoping (or a
  // Cloud Function write path instead of a direct client write).
  it("SECURITY FINDING: an unauthenticated user can wipe the entire requests node, not just add one", async () => {
    await seed("requests/someone-elses-request", { text: "a real pending request from someone else" });
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(remove(ref(db, "requests")));
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
