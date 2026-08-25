import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";

// index.js is plain CommonJS (`require('firebase-admin/app')` /
// `require('firebase-admin/firestore')`, the modular admin SDK), which
// Vitest's module graph does not intercept via vi.mock — that mechanism
// only covers modules reached through the ESM import graph. Instead we
// pre-seed Node's own require.cache for those two submodule paths with fake
// modules before dynamically importing index.js, so its internal require()
// calls resolve to the fakes without ever loading the real
// @google-cloud/firestore client.
const require = createRequire(import.meta.url);
const appPath = require.resolve("firebase-admin/app");
const firestorePath = require.resolve("firebase-admin/firestore");
const realAppCacheEntry = require.cache[appPath];
const realFirestoreCacheEntry = require.cache[firestorePath];

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
    delete: async () => {
      store.delete(key);
    },
  };
}

const fakeDb = {
  collection: (path) => ({
    doc: (id) => makeDocRef(path, id),
  }),
};

require.cache[appPath] = {
  id: appPath,
  filename: appPath,
  loaded: true,
  exports: { initializeApp: () => {} },
};
require.cache[firestorePath] = {
  id: firestorePath,
  filename: firestorePath,
  loaded: true,
  exports: {
    getFirestore: () => fakeDb,
    FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
  },
};

const {
  confirmEventPaymentStub,
  suspendEvent,
  restoreEvent,
  blockEvent,
  deleteEvent,
} = await import("../index.js");

afterAll(() => {
  if (realAppCacheEntry) {
    require.cache[appPath] = realAppCacheEntry;
  } else {
    delete require.cache[appPath];
  }
  if (realFirestoreCacheEntry) {
    require.cache[firestorePath] = realFirestoreCacheEntry;
  } else {
    delete require.cache[firestorePath];
  }
});

const ADMIN_UID = "admin-uid";
const OWNER_UID = "owner-uid";
const OTHER_UID = "other-uid";

beforeEach(() => {
  store.clear();
  store.set(`admins/${ADMIN_UID}`, { email: "admin@example.com" });
});

describe("suspendEvent", () => {
  it("throws unauthenticated when there is no auth context", async () => {
    await expect(suspendEvent.run({ data: {}, auth: undefined })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws permission-denied when the caller is not an admin", async () => {
    await expect(
      suspendEvent.run({ data: { eventId: "evt1" }, auth: { uid: OTHER_UID } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws invalid-argument when eventId is missing", async () => {
    await expect(
      suspendEvent.run({ data: {}, auth: { uid: ADMIN_UID } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("suspends the event and stamps moderatedAt/moderatedBy for an admin caller", async () => {
    store.set("businessEvents/evt1", { status: "approved", ownerId: OWNER_UID });

    const result = await suspendEvent.run({
      data: { eventId: "evt1" },
      auth: { uid: ADMIN_UID },
    });

    expect(result).toEqual({ ok: true });
    expect(store.get("businessEvents/evt1")).toMatchObject({
      status: "suspended",
      moderatedAt: "SERVER_TIMESTAMP",
      moderatedBy: ADMIN_UID,
    });
    expect(store.get("businessEvents/evt1").moderationReason).toBeUndefined();
  });

  it("stores a trimmed moderationReason when one is given", async () => {
    store.set("businessEvents/evt1", { status: "approved", ownerId: OWNER_UID });

    await suspendEvent.run({
      data: { eventId: "evt1", reason: "  Meerdere klachten ontvangen.  " },
      auth: { uid: ADMIN_UID },
    });

    expect(store.get("businessEvents/evt1")).toMatchObject({
      moderationReason: "Meerdere klachten ontvangen.",
    });
  });

  it("omits moderationReason when only whitespace is given", async () => {
    store.set("businessEvents/evt1", { status: "approved", ownerId: OWNER_UID });

    await suspendEvent.run({
      data: { eventId: "evt1", reason: "   " },
      auth: { uid: ADMIN_UID },
    });

    expect(store.get("businessEvents/evt1").moderationReason).toBeUndefined();
  });
});

describe("restoreEvent", () => {
  it("throws unauthenticated when there is no auth context", async () => {
    await expect(restoreEvent.run({ data: {}, auth: undefined })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws permission-denied when the caller is not an admin", async () => {
    await expect(
      restoreEvent.run({ data: { eventId: "evt1" }, auth: { uid: OTHER_UID } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws invalid-argument when eventId is missing", async () => {
    await expect(
      restoreEvent.run({ data: {}, auth: { uid: ADMIN_UID } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("sets a suspended event back to approved for an admin caller", async () => {
    store.set("businessEvents/evt1", {
      status: "suspended",
      ownerId: OWNER_UID,
      moderationReason: "oude reden",
    });

    const result = await restoreEvent.run({
      data: { eventId: "evt1" },
      auth: { uid: ADMIN_UID },
    });

    expect(result).toEqual({ ok: true });
    expect(store.get("businessEvents/evt1").status).toBe("approved");
  });
});

describe("blockEvent", () => {
  it("throws unauthenticated when there is no auth context", async () => {
    await expect(blockEvent.run({ data: {}, auth: undefined })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws permission-denied when the caller is not an admin", async () => {
    await expect(
      blockEvent.run({ data: { eventId: "evt1" }, auth: { uid: OTHER_UID } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws invalid-argument when eventId is missing", async () => {
    await expect(
      blockEvent.run({ data: {}, auth: { uid: ADMIN_UID } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("blocks the event and stamps moderatedAt/moderatedBy for an admin caller", async () => {
    store.set("businessEvents/evt1", { status: "approved", ownerId: OWNER_UID });

    const result = await blockEvent.run({
      data: { eventId: "evt1", reason: "Nepevenement." },
      auth: { uid: ADMIN_UID },
    });

    expect(result).toEqual({ ok: true });
    expect(store.get("businessEvents/evt1")).toMatchObject({
      status: "blocked",
      moderatedAt: "SERVER_TIMESTAMP",
      moderatedBy: ADMIN_UID,
      moderationReason: "Nepevenement.",
    });
  });
});

describe("deleteEvent", () => {
  it("throws unauthenticated when there is no auth context", async () => {
    await expect(deleteEvent.run({ data: {}, auth: undefined })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws permission-denied when the caller is not an admin", async () => {
    await expect(
      deleteEvent.run({ data: { eventId: "evt1" }, auth: { uid: OTHER_UID } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws invalid-argument when eventId is missing", async () => {
    await expect(
      deleteEvent.run({ data: {}, auth: { uid: ADMIN_UID } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("deletes the event document for an admin caller, regardless of ownership", async () => {
    store.set("businessEvents/evt1", { status: "approved", ownerId: OWNER_UID });

    const result = await deleteEvent.run({
      data: { eventId: "evt1" },
      auth: { uid: ADMIN_UID },
    });

    expect(result).toEqual({ ok: true });
    expect(store.has("businessEvents/evt1")).toBe(false);
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
    store.set("businessEvents/evt1", { status: "pending", ownerId: OWNER_UID });

    await expect(
      confirmEventPaymentStub.run({ data: { eventId: "evt1" }, auth: { uid: OTHER_UID } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws failed-precondition when the event is not pending (already paid)", async () => {
    store.set("businessEvents/evt1", { status: "approved", paid: true, ownerId: OWNER_UID });

    await expect(
      confirmEventPaymentStub.run({ data: { eventId: "evt1" }, auth: { uid: OWNER_UID } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("throws failed-precondition when the event was suspended/blocked before payment", async () => {
    store.set("businessEvents/evt1", { status: "blocked", ownerId: OWNER_UID });

    await expect(
      confirmEventPaymentStub.run({ data: { eventId: "evt1" }, auth: { uid: OWNER_UID } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("pays and publishes the event directly for its pending, owning caller — no separate approval step", async () => {
    store.set("businessEvents/evt1", { status: "pending", ownerId: OWNER_UID });

    const result = await confirmEventPaymentStub.run({
      data: { eventId: "evt1" },
      auth: { uid: OWNER_UID },
    });

    expect(result).toEqual({ ok: true });
    expect(store.get("businessEvents/evt1")).toMatchObject({
      status: "approved",
      paid: true,
      paidAt: "SERVER_TIMESTAMP",
    });
  });
});
