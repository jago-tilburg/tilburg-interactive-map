import { afterEach, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { ref, get, set } from "firebase/database";
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
});

describe("shopViews", () => {
  it("allows public read and public write", async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(set(ref(db, "shopViews/shop1"), 1));
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
