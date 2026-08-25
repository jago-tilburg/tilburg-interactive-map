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

  it("allows anyone, even unauthenticated, to write a single userReviews item by its own key", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(
      set(ref(db, "shops/shop1/userReviews/rev1"), {
        id: 1,
        userId: OTHER_UID,
        userName: "A",
        rating: 8,
        text: "Great!",
        createdAt: "t",
      }),
    );
  });

  it("allows anyone to read/write a single userRatings item, keyed by userId", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(
      set(ref(db, `shops/shop1/userRatings/${OTHER_UID}`), { userId: OTHER_UID, rating: 4.5, createdAt: 1 }),
    );
    await assertSucceeds(get(ref(db, "shops/shop1/userRatings")));
  });

  it("allows anyone to write a single comment by its own key", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(
      set(ref(db, "shops/shop1/comments/c1"), { id: 1, userId: OTHER_UID, userName: "A", text: "Nice", createdAt: "t" }),
    );
  });

  it("allows anyone to read/write a single like, keyed by userId", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, `shops/shop1/likes/${OTHER_UID}`), true));
    await assertSucceeds(get(ref(db, "shops/shop1/likes")));
  });

  // FIXED (2026-08-25, data-model migration): comments/likes/userRatings/
  // userReviews used to be stored as an array-at-parent-path, and
  // `.write:true` at that PARENT node granted write to the whole subtree —
  // an unauthenticated caller could wipe or overwrite every OTHER user's
  // item in one call, not just add their own (see the git history of this
  // file for the previous "SECURITY FINDING" tests documenting that). Now
  // each of the four is a keyed-child object (likes: {userId: true}, the
  // rest: {itemId: {...}}) with `.write` granted only at $key level and no
  // parent-level grant at all — a write can touch at most one item.
  //
  // This does NOT add per-user ownership verification (auth.uid === $key):
  // the app intentionally supports anonymous local-id likes/comments/
  // ratings/reviews with no real auth token to check, so that was never
  // achievable without breaking that feature. What's fixed is the blast
  // radius — bulk wipe/overwrite of an entire shop's interactions — not
  // impersonation of a single other user's item, which stays open by design
  // (matches the userReviews/likes/comments "allows anyone" tests above).
  it("denies wiping the entire comments node in one call", async () => {
    await seed("shops/shop1/comments/real-user-comment", { id: 1, userId: "real-user", userName: "R", text: "genuine comment", createdAt: "t" });
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(remove(ref(db, "shops/shop1/comments")));
    const after = await get(ref(db, "shops/shop1/comments/real-user-comment"));
    if (!after.exists()) throw new Error("expected the comment to survive the denied wipe attempt");
  });

  it("denies wiping the entire likes node in one call", async () => {
    await seed("shops/shop1/likes", { "real-user": true });
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(remove(ref(db, "shops/shop1/likes")));
  });

  it("denies wiping the entire userRatings node in one call", async () => {
    await seed("shops/shop1/userRatings", { "real-user": { userId: "real-user", rating: 5, createdAt: 1 } });
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(remove(ref(db, "shops/shop1/userRatings")));
  });

  it("denies wiping the entire userReviews node in one call", async () => {
    await seed("shops/shop1/userReviews", {
      "real-review": { id: 1, userId: "real-user", userName: "R", rating: 8, text: "genuine review", createdAt: "t" },
    });
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(remove(ref(db, "shops/shop1/userReviews")));
  });

  it("still allows deleting a single comment by its own key", async () => {
    await seed("shops/shop1/comments/c1", { id: 1, userId: "u1", userName: "A", text: "Nice", createdAt: "t" });
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(remove(ref(db, "shops/shop1/comments/c1")));
  });

  it("still allows deleting a single like by its own key", async () => {
    await seed(`shops/shop1/likes/${OTHER_UID}`, true);
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(remove(ref(db, `shops/shop1/likes/${OTHER_UID}`)));
  });
});

describe("data shape / type validation", () => {
  // FIXED (2026-08-25): originally these `.validate` clauses lived at the
  // comments/likes/userRatings/userReviews PARENT node (checking only "is
  // this a non-empty container at all"). Now that each is a keyed-child
  // object with write scoped to $key, validation moved down to the same
  // $key level and got stricter: each item must have the specific fields
  // the app always writes (hasChildren([...])), not just "any container
  // shape" — rejects both a raw string/number AND a same-shape-but-wrong
  // object.
  it("denies overwriting a single comment with a raw string", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, "shops/shop1/comments/c1"), "not an object"));
  });

  it("denies a comment missing required fields", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, "shops/shop1/comments/c1"), { userId: "u1" }));
  });

  it("denies overwriting a single like with a non-boolean", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, `shops/shop1/likes/${OTHER_UID}`), "yes"));
  });

  it("denies a userRating missing required fields", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, `shops/shop1/userRatings/${OTHER_UID}`), { rating: 5 }));
  });

  it("denies a userReview missing required fields", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(set(ref(db, "shops/shop1/userReviews/rev1"), { userId: "u1", text: "no rating field" }));
  });

  it("still allows a legitimate single-comment write matching the app's real shape", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(
      set(ref(db, "shops/shop1/comments/c1"), { id: 1, userId: "u1", userName: "A", text: "Nice", createdAt: "t" }),
    );
  });

  it("still allows deleting a single comment (setting to null, which RTDB treats as delete)", async () => {
    await seed("shops/shop1/comments/c1", { id: 1, userId: "u1", userName: "A", text: "Nice", createdAt: "t" });
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(remove(ref(db, "shops/shop1/comments/c1")));
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
