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

  // FIXED (2026-08-25): unlike visitors/businesses (which type-check
  // email/displayName/businessName as strings), businessEvents' create
  // rule used to only check field PRESENCE via hasAll() — no `is string` /
  // `is number` checks on any field, and no length bound. Now rejects
  // wrong-typed and oversized values explicitly.
  it("denies create with wrong-typed fields (lat/lng as strings, title as an object)", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(
      setDoc(
        doc(db, "businessEvents", EVENT_ID),
        validEvent({ lat: "not-a-number", lng: "not-a-number", title: { nested: "object, not a string" } }),
      ),
    );
  });

  it("denies create with an unbounded-length title", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(setDoc(doc(db, "businessEvents", EVENT_ID), validEvent({ title: "x".repeat(50000) })));
  });

  it("allows the owner to create a pending, unpaid event with all required fields", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(setDoc(doc(db, "businessEvents", EVENT_ID), validEvent()));
  });

  it("allows optional fields (multiDay, dailyTimes, umbrellaEventId) without requiring them", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "umbrellaEvents", "u1"), { title: "Real Festival" });
    });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      setDoc(doc(db, "businessEvents", EVENT_ID), validEvent({ multiDay: true, dailyTimes: [], umbrellaEventId: "u1" })),
    );
  });

  it("allows create with no umbrellaEventId at all (the common case)", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(setDoc(doc(db, "businessEvents", EVENT_ID), validEvent()));
  });

  // FIXED (2026-08-25): umbrellaEventId used to never be validated against
  // a real umbrellaEvents/{id} doc. A business could tag their event under
  // a nonexistent id, or a real festival they have no actual affiliation
  // with — the UI then shows a "🎪 Onderdeel van [festival]" badge with no
  // admin-approved association behind it. Now requires the id to exist.
  it("denies create with a nonexistent umbrellaEventId", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(
      setDoc(doc(db, "businessEvents", EVENT_ID), validEvent({ umbrellaEventId: "totally-made-up-festival-id" })),
    );
  });

  it("allows create with an explicit null umbrellaEventId, same as omitting it", async () => {
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(setDoc(doc(db, "businessEvents", EVENT_ID), validEvent({ umbrellaEventId: null })));
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

  // FIXED (2026-08-25): the "allows the owner to edit non-restricted
  // fields" test above only seeds a PENDING event. The rule used to allow
  // status to stay unchanged OR go approved->pending on ANY edit — it
  // never forced approved->pending specifically on a "significant" content
  // edit (title/dates/location — mirroring BusinessEventFormModal's own
  // significantChange check), so a direct write bypassing that UI could
  // change an already-approved event's headline details while it stayed
  // visibly "approved," with no re-review. Now mirrors the same
  // significant-fields list the client already uses.
  it("denies changing an APPROVED event's title while status stays approved", async () => {
    await seedEvent({ status: "approved", title: "Original, admin-approved title" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(
      updateDoc(doc(db, "businessEvents", EVENT_ID), { title: "Silently changed after approval, still shows approved" }),
    );
  });

  it("denies changing an APPROVED event's startDate/endDate/lat/lng while status stays approved", async () => {
    await seedEvent({ status: "approved" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(updateDoc(doc(db, "businessEvents", EVENT_ID), { startDate: "2026-10-01" }));
    await assertFails(updateDoc(doc(db, "businessEvents", EVENT_ID), { lat: 52.0 }));
  });

  it("allows changing a significant field on an APPROVED event IF status is pulled back to pending in the same write", async () => {
    await seedEvent({ status: "approved", title: "Original title" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, "businessEvents", EVENT_ID), { title: "New title", status: "pending" }),
    );
  });

  // Matches the app's actual, intentional policy (BusinessEventFormModal's
  // significantChange list) — description/prices/photoUrl/websiteUrl/etc.
  // are NOT "significant," so editing them shouldn't force re-review. This
  // fix must not break that legitimate, deliberate behavior.
  it("allows changing a NON-significant field (description) on an APPROVED event without touching status", async () => {
    await seedEvent({ status: "approved" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(updateDoc(doc(db, "businessEvents", EVENT_ID), { description: "Updated description" }));
  });

  it("still allows editing any field freely on a PENDING (not yet approved) event", async () => {
    await seedEvent({ status: "pending", title: "Draft title" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(updateDoc(doc(db, "businessEvents", EVENT_ID), { title: "Revised draft title" }));
  });

  it("denies updating with an unbounded-length title", async () => {
    await seedEvent({ status: "pending" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(updateDoc(doc(db, "businessEvents", EVENT_ID), { title: "x".repeat(50000) }));
  });

  it("denies updating umbrellaEventId to a nonexistent umbrella", async () => {
    await seedEvent({ status: "pending" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertFails(updateDoc(doc(db, "businessEvents", EVENT_ID), { umbrellaEventId: "made-up-id" }));
  });

  it("allows updating umbrellaEventId to a real umbrella", async () => {
    await seedEvent({ status: "pending" });
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "umbrellaEvents", "u1"), { title: "Real Festival" });
    });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(updateDoc(doc(db, "businessEvents", EVENT_ID), { umbrellaEventId: "u1" }));
  });

  it("allows clearing umbrellaEventId back to null", async () => {
    await seedEvent({ status: "pending", umbrellaEventId: "u1" });
    const db = testEnv.authenticatedContext(OWNER_UID).firestore();
    await assertSucceeds(updateDoc(doc(db, "businessEvents", EVENT_ID), { umbrellaEventId: null }));
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
