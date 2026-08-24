import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";

// index.js is plain CommonJS (`require('firebase-admin')`), which Vitest's
// module graph does not intercept via vi.mock — that mechanism only covers
// modules reached through the ESM import graph. Instead we pre-seed Node's
// own require.cache for 'firebase-admin' with a fake module before dynamically
// importing index.js, so its internal require() call resolves to the fake
// without ever loading the real @google-cloud/firestore client.
const require = createRequire(import.meta.url);
const adminPath = require.resolve("firebase-admin");
const realCacheEntry = require.cache[adminPath];

const store = new Map();

function makeDocRef(path, id) {
  const key = `${path}/${id}`;
  return {
    get: async () => ({
      exists: store.has(key),
      data: () => store.get(key),
    }),
    update: async (patch) => {
      const current = store.get(key) || {};
      store.set(key, { ...current, ...patch });
    },
  };
}

const fakeDb = {
  collection: (path) => ({
    doc: (id) => makeDocRef(path, id),
  }),
};

const firestoreFn = Object.assign(() => fakeDb, {
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
});

require.cache[adminPath] = {
  id: adminPath,
  filename: adminPath,
  loaded: true,
  exports: { initializeApp: () => {}, firestore: firestoreFn },
};

const { approveEvent, rejectEvent, confirmEventPaymentStub } = await import("../index.js");

afterAll(() => {
  if (realCacheEntry) {
    require.cache[adminPath] = realCacheEntry;
  } else {
    delete require.cache[adminPath];
  }
});

const ADMIN_UID = "admin-uid";
const OWNER_UID = "owner-uid";
const OTHER_UID = "other-uid";

beforeEach(() => {
  store.clear();
  store.set(`admins/${ADMIN_UID}`, { email: "admin@example.com" });
});

describe("approveEvent", () => {
  it("throws unauthenticated when there is no auth context", async () => {
    await expect(approveEvent.run({ data: {}, auth: undefined })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws permission-denied when the caller is not an admin", async () => {
    await expect(
      approveEvent.run({ data: { eventId: "evt1" }, auth: { uid: OTHER_UID } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws invalid-argument when eventId is missing", async () => {
    await expect(
      approveEvent.run({ data: {}, auth: { uid: ADMIN_UID } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("approves the event and stamps reviewedAt/reviewedBy for an admin caller", async () => {
    store.set("businessEvents/evt1", { status: "pending", ownerId: OWNER_UID });

    const result = await approveEvent.run({
      data: { eventId: "evt1" },
      auth: { uid: ADMIN_UID },
    });

    expect(result).toEqual({ ok: true });
    expect(store.get("businessEvents/evt1")).toMatchObject({
      status: "approved",
      reviewedAt: "SERVER_TIMESTAMP",
      reviewedBy: ADMIN_UID,
    });
  });
});

describe("rejectEvent", () => {
  it("throws unauthenticated when there is no auth context", async () => {
    await expect(rejectEvent.run({ data: {}, auth: undefined })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws permission-denied when the caller is not an admin", async () => {
    await expect(
      rejectEvent.run({ data: { eventId: "evt1" }, auth: { uid: OTHER_UID } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws invalid-argument when eventId is missing", async () => {
    await expect(
      rejectEvent.run({ data: {}, auth: { uid: ADMIN_UID } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects the event and stamps reviewedAt/reviewedBy for an admin caller", async () => {
    store.set("businessEvents/evt1", { status: "pending", ownerId: OWNER_UID });

    const result = await rejectEvent.run({
      data: { eventId: "evt1" },
      auth: { uid: ADMIN_UID },
    });

    expect(result).toEqual({ ok: true });
    expect(store.get("businessEvents/evt1")).toMatchObject({
      status: "rejected",
      reviewedAt: "SERVER_TIMESTAMP",
      reviewedBy: ADMIN_UID,
    });
    expect(store.get("businessEvents/evt1").rejectionReason).toBeUndefined();
  });

  it("stores a trimmed rejectionReason when one is given", async () => {
    store.set("businessEvents/evt1", { status: "pending", ownerId: OWNER_UID });

    await rejectEvent.run({
      data: { eventId: "evt1", reason: "  Adres komt niet overeen met KVK-registratie.  " },
      auth: { uid: ADMIN_UID },
    });

    expect(store.get("businessEvents/evt1")).toMatchObject({
      status: "rejected",
      rejectionReason: "Adres komt niet overeen met KVK-registratie.",
    });
  });

  it("omits rejectionReason when only whitespace is given", async () => {
    store.set("businessEvents/evt1", { status: "pending", ownerId: OWNER_UID });

    await rejectEvent.run({
      data: { eventId: "evt1", reason: "   " },
      auth: { uid: ADMIN_UID },
    });

    expect(store.get("businessEvents/evt1").rejectionReason).toBeUndefined();
  });
});

describe("confirmEventPaymentStub", () => {
  it("throws unauthenticated when there is no auth context", async () => {
    await expect(
      confirmEventPaymentStub.run({ data: { eventId: "evt1" }, auth: undefined }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("throws not-found when the event doc does not exist (including when eventId/data is missing)", async () => {
    await expect(
      confirmEventPaymentStub.run({ data: undefined, auth: { uid: OWNER_UID } }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("throws permission-denied when the caller does not own the event", async () => {
    store.set("businessEvents/evt1", { status: "approved", ownerId: OWNER_UID });

    await expect(
      confirmEventPaymentStub.run({ data: { eventId: "evt1" }, auth: { uid: OTHER_UID } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws failed-precondition when the event is not yet approved", async () => {
    store.set("businessEvents/evt1", { status: "pending", ownerId: OWNER_UID });

    await expect(
      confirmEventPaymentStub.run({ data: { eventId: "evt1" }, auth: { uid: OWNER_UID } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("marks the event paid for its approved, owning caller", async () => {
    store.set("businessEvents/evt1", { status: "approved", ownerId: OWNER_UID });

    const result = await confirmEventPaymentStub.run({
      data: { eventId: "evt1" },
      auth: { uid: OWNER_UID },
    });

    expect(result).toEqual({ ok: true });
    expect(store.get("businessEvents/evt1")).toMatchObject({
      paid: true,
      paidAt: "SERVER_TIMESTAMP",
    });
  });
});
