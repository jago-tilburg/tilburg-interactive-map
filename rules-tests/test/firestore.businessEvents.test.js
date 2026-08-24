import { afterEach, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getTestEnv } from "./testEnv.js";

const OWNER_UID = "owner-uid";
const OTHER_UID = "other-uid";
const ADMIN_UID = "admin-uid";
const EVENT_ID = "evt1";

function validEvent(overrides = {}) {
  return {
    title: "Test Event",
    category: "food",
    description: "A test event",
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    startTime: "10:00",
    endTime: "18:00",
    lat: 51.5555,
    lng: 5.0913,
    address: "Heuvelplein 1, Tilburg",
    ownerId: OWNER_UID,
    status: "pending",
    paid: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

let testEnv;

beforeAll(async () => {
  testEnv = await getTestEnv();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

async function seedEvent(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "businessEvents", EVENT_ID), validEvent(overrides));
  });
}

async function seedAdmin(uid = ADMIN_UID) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "admins", uid), { email: "admin@example.com" });
  });
}

describe("businessEvents/{eventId} create", () => {
  it("denies create by an unauthenticated user", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "businessEvents", EVENT_ID), validEvent()));
  });

  it("denies create where ownerId does not match the caller", async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(setDoc(doc(db, "businessEvents", EVENT_ID), validEvent()));
  });

  it("denies create with a non-pending status", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(setDoc(doc(db, "businessEvents", EVENT_ID), validEvent({ status: "approved" })));
  });

  it("denies create with paid set to true", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(setDoc(doc(db, "businessEvents", EVENT_ID), validEvent({ paid: true })));
  });

  it("denies create missing a required field", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    const { address, ...missingAddress } = validEvent();
    await assertFails(setDoc(doc(db, "businessEvents", EVENT_ID), missingAddress));
  });

  // SECURITY FINDING (2026-08-24): unlike visitors/businesses (which
  // type-check email/displayName/businessName as strings), businessEvents'
  // create rule only checks field PRESENCE via hasAll() — no `is string` /
  // `is number` checks on any field. lat/lng can be non-numeric, title can
  // be an object/array/huge string, etc. hasAll() being satisfied says
  // nothing about what the values actually are. Not yet remediated.
  it("SECURITY FINDING: create is allowed with wrong-typed fields (lat/lng as strings, title as an object)", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(
        doc(db, "businessEvents", EVENT_ID),
        validEvent({ lat: "not-a-number", lng: "not-a-number", title: { nested: "object, not a string" } }),
      ),
    );
  });

  it("SECURITY FINDING: create is allowed with an unbounded-length title (no size limit enforced)", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(setDoc(doc(db, "businessEvents", EVENT_ID), validEvent({ title: "x".repeat(50000) })));
  });

  it("allows the owner to create a pending, unpaid event with all required fields", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(setDoc(doc(db, "businessEvents", EVENT_ID), validEvent()));
  });

  it("allows optional fields (multiDay, dailyTimes, umbrellaEventId) without requiring them", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, "businessEvents", EVENT_ID), validEvent({ multiDay: true, dailyTimes: [], umbrellaEventId: "u1" })),
    );
  });

  // SECURITY FINDING (2026-08-24): umbrellaEventId is never validated
  // against a real umbrellaEvents/{id} doc (no exists() check, unlike the
  // admin-membership check umbrellaEvents' own write rule uses). A business
  // can tag their event under a nonexistent id, or a real festival they
  // have no actual affiliation with — the UI then shows a "🎪 Onderdeel van
  // [festival]" badge with no admin-approved association behind it. Not
  // yet remediated.
  it("SECURITY FINDING: create is allowed with a nonexistent umbrellaEventId (no existence/ownership check)", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, "businessEvents", EVENT_ID), validEvent({ umbrellaEventId: "totally-made-up-festival-id" })),
    );
  });
});

describe("businessEvents/{eventId} read", () => {
  it("allows anyone, even unauthenticated, to read an approved event", async () => {
    await seedEvent({ status: "approved" });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "businessEvents", EVENT_ID)));
  });

  it("allows the owner to read their own pending event", async () => {
    await seedEvent({ status: "pending" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(getDoc(doc(db, "businessEvents", EVENT_ID)));
  });

  it("allows an admin to read a pending event they don't own", async () => {
    await seedEvent({ status: "pending" });
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(getDoc(doc(db, "businessEvents", EVENT_ID)));
  });

  it("denies a non-owner, non-admin authenticated user from reading a pending event", async () => {
    await seedEvent({ status: "pending" });
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(db, "businessEvents", EVENT_ID)));
  });

  it("denies an unauthenticated user from reading a pending event", async () => {
    await seedEvent({ status: "pending" });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "businessEvents", EVENT_ID)));
  });
});

describe("businessEvents/{eventId} update", () => {
  it("allows the owner to edit non-restricted fields", async () => {
    await seedEvent({ status: "pending" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(updateDoc(doc(db, "businessEvents", EVENT_ID), { title: "Updated title" }));
  });

  it("allows the owner to pull an approved event back to pending", async () => {
    await seedEvent({ status: "approved" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(updateDoc(doc(db, "businessEvents", EVENT_ID), { status: "pending" }));
  });

  it("denies the owner setting status to approved directly", async () => {
    await seedEvent({ status: "pending" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(updateDoc(doc(db, "businessEvents", EVENT_ID), { status: "approved" }));
  });

  it("denies the owner changing paid directly", async () => {
    await seedEvent({ status: "approved", paid: false });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(updateDoc(doc(db, "businessEvents", EVENT_ID), { paid: true }));
  });

  it("denies the owner reassigning ownerId", async () => {
    await seedEvent({ status: "pending" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(updateDoc(doc(db, "businessEvents", EVENT_ID), { ownerId: OTHER_UID }));
  });

  it("denies a non-owner from updating the event at all", async () => {
    await seedEvent({ status: "pending" });
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(updateDoc(doc(db, "businessEvents", EVENT_ID), { title: "hijacked" }));
  });

  // SECURITY FINDING (2026-08-24): the "allows the owner to edit
  // non-restricted fields" test above only seeds a PENDING event. The rule
  // itself allows status to stay unchanged OR go approved->pending — it
  // never forces approved->pending on a content edit, so an owner can
  // directly write to Firestore (bypassing the app's own UI, which happens
  // to always reset status when editing) and change an already-APPROVED
  // event's title/price/description/date while it stays visibly
  // "approved," with no re-review. The app's UI isn't a security boundary;
  // the rule is, and the rule doesn't require it. Not yet remediated.
  it("SECURITY FINDING: owner can edit an APPROVED event's content while it stays approved, no re-review forced", async () => {
    await seedEvent({ status: "approved", title: "Original, admin-approved title" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, "businessEvents", EVENT_ID), { title: "Silently changed after approval, still shows approved" }),
    );
  });
});

describe("businessEvents/{eventId} public engagement counters", () => {
  it("allows an unauthenticated visitor to bump the view count on an approved event", async () => {
    await seedEvent({ status: "approved", views: 0 });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(updateDoc(doc(db, "businessEvents", EVENT_ID), { views: 1 }));
  });

  it("allows an unauthenticated visitor to bump the interest count on an approved event", async () => {
    await seedEvent({ status: "approved", interest: 0 });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(updateDoc(doc(db, "businessEvents", EVENT_ID), { interest: 1 }));
  });

  it("allows an unauthenticated visitor to bump the click count on an approved event", async () => {
    await seedEvent({ status: "approved", clicks: 0 });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(updateDoc(doc(db, "businessEvents", EVENT_ID), { clicks: 1 }));
  });

  it("denies bumping the view count on a pending event", async () => {
    await seedEvent({ status: "pending", views: 0 });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(updateDoc(doc(db, "businessEvents", EVENT_ID), { views: 1 }));
  });

  it("denies smuggling a status change alongside a counter bump", async () => {
    await seedEvent({ status: "approved", views: 0 });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      updateDoc(doc(db, "businessEvents", EVENT_ID), { views: 1, status: "pending" }),
    );
  });

  it("denies smuggling a paid change alongside a counter bump", async () => {
    await seedEvent({ status: "approved", paid: false, views: 0 });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(updateDoc(doc(db, "businessEvents", EVENT_ID), { views: 1, paid: true }));
  });

  it("denies changing an unrelated field via the counter-update branch", async () => {
    await seedEvent({ status: "approved", views: 0 });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(updateDoc(doc(db, "businessEvents", EVENT_ID), { title: "hijacked" }));
  });
});

describe("businessEvents/{eventId} delete", () => {
  it("allows the owner to delete their own event", async () => {
    await seedEvent();
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(deleteDoc(doc(db, "businessEvents", EVENT_ID)));
  });

  it("denies a non-owner from deleting the event", async () => {
    await seedEvent();
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(deleteDoc(doc(db, "businessEvents", EVENT_ID)));
  });

  it("denies an unauthenticated user from deleting the event", async () => {
    await seedEvent();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(deleteDoc(doc(db, "businessEvents", EVENT_ID)));
  });
});
