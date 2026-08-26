import { afterAll, beforeEach, describe, expect, it } from "vitest";
// See testFakes.js for why index.js's plain CommonJS require() calls need
// this require.cache-patching approach instead of vi.mock.
import {
  firestoreStore as store,
  restoreRealModules,
  stripeSessionsCreateCalls,
  setStripeSessionResult,
  setStripeWebhookEvent,
  setStripeWebhookSignatureInvalid,
} from "./testFakes.js";

const {
  createCheckoutSession,
  stripeWebhook,
  suspendEvent,
  restoreEvent,
  blockEvent,
  deleteEvent,
} = await import("../index.js");

afterAll(restoreRealModules);

const ADMIN_UID = "admin-uid";
const OWNER_UID = "owner-uid";
const OTHER_UID = "other-uid";

beforeEach(() => {
  store.clear();
  store.set(`admins/${ADMIN_UID}`, { email: "admin@example.com" });
  stripeSessionsCreateCalls.length = 0;
});

function fakeWebhookRequest(overrides = {}) {
  return {
    headers: { "stripe-signature": "t=1,v1=fake" },
    rawBody: Buffer.from("{}"),
    ...overrides,
  };
}

function fakeWebhookResponse() {
  return {
    _code: null,
    _body: null,
    status(code) {
      this._code = code;
      return this;
    },
    send(body) {
      this._body = body;
    },
  };
}

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

describe("createCheckoutSession", () => {
  it("throws unauthenticated when there is no auth context", async () => {
    await expect(
      createCheckoutSession.run({ data: { eventId: "evt1" }, auth: undefined }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("throws not-found when the event doc does not exist (including when eventId/data is missing)", async () => {
    await expect(
      createCheckoutSession.run({ data: undefined, auth: { uid: OWNER_UID } }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("throws permission-denied when the caller does not own the event", async () => {
    store.set("businessEvents/evt1", { status: "pending", ownerId: OWNER_UID });

    await expect(
      createCheckoutSession.run({ data: { eventId: "evt1" }, auth: { uid: OTHER_UID } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("throws failed-precondition when the event is not pending (already paid)", async () => {
    store.set("businessEvents/evt1", { status: "approved", paid: true, ownerId: OWNER_UID });

    await expect(
      createCheckoutSession.run({ data: { eventId: "evt1" }, auth: { uid: OWNER_UID } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("throws failed-precondition when the event was suspended/blocked before payment", async () => {
    store.set("businessEvents/evt1", { status: "blocked", ownerId: OWNER_UID });

    await expect(
      createCheckoutSession.run({ data: { eventId: "evt1" }, auth: { uid: OWNER_UID } }),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("creates a Stripe Checkout Session for its pending, owning caller and returns the session URL", async () => {
    store.set("businessEvents/evt1", { status: "pending", ownerId: OWNER_UID, title: "Kermis" });
    setStripeSessionResult({ id: "cs_test_1", url: "https://checkout.stripe.com/session/cs_test_1" });

    const result = await createCheckoutSession.run({
      data: { eventId: "evt1" },
      auth: { uid: OWNER_UID },
    });

    expect(result).toEqual({ url: "https://checkout.stripe.com/session/cs_test_1" });
    expect(stripeSessionsCreateCalls).toHaveLength(1);
    const params = stripeSessionsCreateCalls[0];
    expect(params.mode).toBe("payment");
    expect(params.payment_method_types).toEqual(["card", "ideal"]);
    expect(params.allow_promotion_codes).toBe(true);
    expect(params.metadata).toEqual({ eventId: "evt1" });
    // Event doc's own paid/status are untouched here — only the webhook
    // (once Stripe confirms the money moved) is allowed to change them.
    expect(store.get("businessEvents/evt1")).toMatchObject({ status: "pending" });
    expect(store.get("businessEvents/evt1").paid).toBeUndefined();
  });
});

describe("stripeWebhook", () => {
  it("rejects an invalid signature with 400 and does not touch the event", async () => {
    store.set("businessEvents/evt1", { status: "pending", ownerId: OWNER_UID });
    setStripeWebhookSignatureInvalid();

    const res = fakeWebhookResponse();
    await stripeWebhook(fakeWebhookRequest(), res);

    expect(res._code).toBe(400);
    expect(store.get("businessEvents/evt1")).toMatchObject({ status: "pending" });
  });

  it("ignores event types other than checkout.session.completed", async () => {
    setStripeWebhookEvent({ type: "payment_intent.created", data: { object: {} } });

    const res = fakeWebhookResponse();
    await stripeWebhook(fakeWebhookRequest(), res);

    expect(res._code).toBe(200);
  });

  it("is a no-op (200, logged) when checkout.session.completed has no metadata.eventId", async () => {
    setStripeWebhookEvent({
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_2", metadata: {} } },
    });

    const res = fakeWebhookResponse();
    await stripeWebhook(fakeWebhookRequest(), res);

    expect(res._code).toBe(200);
  });

  it("is a no-op (200) when the referenced event doc does not exist", async () => {
    setStripeWebhookEvent({
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_3", metadata: { eventId: "does-not-exist" } } },
    });

    const res = fakeWebhookResponse();
    await stripeWebhook(fakeWebhookRequest(), res);

    expect(res._code).toBe(200);
  });

  it("pays and publishes the event directly — no separate approval step", async () => {
    store.set("businessEvents/evt1", { status: "pending", ownerId: OWNER_UID });
    setStripeWebhookEvent({
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_4", metadata: { eventId: "evt1" } } },
    });

    const res = fakeWebhookResponse();
    await stripeWebhook(fakeWebhookRequest(), res);

    expect(res._code).toBe(200);
    expect(store.get("businessEvents/evt1")).toMatchObject({
      status: "approved",
      paid: true,
      paidAt: "SERVER_TIMESTAMP",
      stripeSessionId: "cs_test_4",
    });
  });

  it("is idempotent — a redelivered webhook for an already-paid event does not re-stamp paidAt", async () => {
    store.set("businessEvents/evt1", {
      status: "approved",
      paid: true,
      paidAt: "ORIGINAL_TIMESTAMP",
      ownerId: OWNER_UID,
    });
    setStripeWebhookEvent({
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_5", metadata: { eventId: "evt1" } } },
    });

    const res = fakeWebhookResponse();
    await stripeWebhook(fakeWebhookRequest(), res);

    expect(res._code).toBe(200);
    expect(store.get("businessEvents/evt1").paidAt).toBe("ORIGINAL_TIMESTAMP");
  });
});
