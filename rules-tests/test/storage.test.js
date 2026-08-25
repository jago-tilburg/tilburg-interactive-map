import { afterEach, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes, deleteObject } from "firebase/storage";
import { getTestEnv } from "./testEnv.js";

const ADMIN_UID = "admin-uid";
const OWNER_UID = "owner-uid";
const OTHER_UID = "other-uid";
const EVENT_ID = "evt1";

const VALID_PHOTO = new Uint8Array(1024).fill(1);
const VALID_METADATA = { contentType: "image/webp" };
const OVERSIZED_PHOTO = new Uint8Array(2 * 1024 * 1024 + 1).fill(1);

let testEnv;

beforeAll(async () => {
  testEnv = await getTestEnv();
});

afterEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
});

async function seedAdmin(uid = ADMIN_UID) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "admins", uid), { email: "admin@example.com" });
  });
}

async function seedEvent(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "businessEvents", EVENT_ID), {
      title: "Test Event",
      ownerId: OWNER_UID,
      status: "pending",
      paid: false,
      ...overrides,
    });
  });
}

async function seedObject(path) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), path), VALID_PHOTO, VALID_METADATA);
  });
}

// shops/{shopId} — shops have no ownerId/business-account concept at all
// (admin-managed only, mirroring database.rules.json's shops write gate).
describe("shops/{shopId}/{fileName}", () => {
  it("allows anyone, even unauthenticated, to read a shop photo", async () => {
    await seedObject("shops/shop1/photo.webp");
    const storage = testEnv.unauthenticatedContext().storage();
    await assertSucceeds(getBytes(ref(storage, "shops/shop1/photo.webp")));
  });

  it("denies an unauthenticated upload", async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(uploadBytes(ref(storage, "shops/shop1/photo.webp"), VALID_PHOTO, VALID_METADATA));
  });

  it("denies upload by an authenticated non-admin", async () => {
    const storage = testEnv.authenticatedContext(OTHER_UID).storage();
    await assertFails(uploadBytes(ref(storage, "shops/shop1/photo.webp"), VALID_PHOTO, VALID_METADATA));
  });

  it("allows upload by an admin", async () => {
    await seedAdmin();
    const storage = testEnv.authenticatedContext(ADMIN_UID).storage();
    await assertSucceeds(uploadBytes(ref(storage, "shops/shop1/photo.webp"), VALID_PHOTO, VALID_METADATA));
  });

  it("denies an admin upload with a non-webp content type", async () => {
    await seedAdmin();
    const storage = testEnv.authenticatedContext(ADMIN_UID).storage();
    await assertFails(
      uploadBytes(ref(storage, "shops/shop1/photo.webp"), VALID_PHOTO, { contentType: "image/png" }),
    );
  });

  it("denies an admin upload over the size bound", async () => {
    await seedAdmin();
    const storage = testEnv.authenticatedContext(ADMIN_UID).storage();
    await assertFails(
      uploadBytes(ref(storage, "shops/shop1/photo.webp"), OVERSIZED_PHOTO, VALID_METADATA),
    );
  });

  it("denies delete by a non-admin", async () => {
    await seedObject("shops/shop1/photo.webp");
    const storage = testEnv.authenticatedContext(OTHER_UID).storage();
    await assertFails(deleteObject(ref(storage, "shops/shop1/photo.webp")));
  });

  it("allows delete by an admin", async () => {
    await seedObject("shops/shop1/photo.webp");
    await seedAdmin();
    const storage = testEnv.authenticatedContext(ADMIN_UID).storage();
    await assertSucceeds(deleteObject(ref(storage, "shops/shop1/photo.webp")));
  });
});

// businessEvents/{eventId} — owner (matches the Firestore doc's ownerId)
// or admin, mirroring firestore.rules' businessEvents ownership check.
describe("businessEvents/{eventId}/{fileName}", () => {
  it("allows anyone, even unauthenticated, to read an event photo", async () => {
    await seedObject("businessEvents/evt1/photo.webp");
    const storage = testEnv.unauthenticatedContext().storage();
    await assertSucceeds(getBytes(ref(storage, "businessEvents/evt1/photo.webp")));
  });

  it("denies upload by an unauthenticated user", async () => {
    await seedEvent();
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(
      uploadBytes(ref(storage, "businessEvents/evt1/photo.webp"), VALID_PHOTO, VALID_METADATA),
    );
  });

  it("denies upload by an authenticated user who isn't the event owner", async () => {
    await seedEvent();
    const storage = testEnv.authenticatedContext(OTHER_UID).storage();
    await assertFails(
      uploadBytes(ref(storage, "businessEvents/evt1/photo.webp"), VALID_PHOTO, VALID_METADATA),
    );
  });

  it("allows upload by the event's owner", async () => {
    await seedEvent();
    const storage = testEnv.authenticatedContext(OWNER_UID).storage();
    await assertSucceeds(
      uploadBytes(ref(storage, "businessEvents/evt1/photo.webp"), VALID_PHOTO, VALID_METADATA),
    );
  });

  it("allows upload by an admin who doesn't own the event", async () => {
    await seedEvent();
    await seedAdmin();
    const storage = testEnv.authenticatedContext(ADMIN_UID).storage();
    await assertSucceeds(
      uploadBytes(ref(storage, "businessEvents/evt1/photo.webp"), VALID_PHOTO, VALID_METADATA),
    );
  });

  it("denies the owner uploading a non-webp content type", async () => {
    await seedEvent();
    const storage = testEnv.authenticatedContext(OWNER_UID).storage();
    await assertFails(
      uploadBytes(ref(storage, "businessEvents/evt1/photo.webp"), VALID_PHOTO, { contentType: "image/jpeg" }),
    );
  });

  it("denies the owner uploading over the size bound", async () => {
    await seedEvent();
    const storage = testEnv.authenticatedContext(OWNER_UID).storage();
    await assertFails(
      uploadBytes(ref(storage, "businessEvents/evt1/photo.webp"), OVERSIZED_PHOTO, VALID_METADATA),
    );
  });

  it("denies upload against a nonexistent event id (no doc for firestore.get to match)", async () => {
    const storage = testEnv.authenticatedContext(OWNER_UID).storage();
    await assertFails(
      uploadBytes(ref(storage, "businessEvents/no-such-event/photo.webp"), VALID_PHOTO, VALID_METADATA),
    );
  });

  it("denies delete by a non-owner, non-admin", async () => {
    await seedEvent();
    await seedObject("businessEvents/evt1/photo.webp");
    const storage = testEnv.authenticatedContext(OTHER_UID).storage();
    await assertFails(deleteObject(ref(storage, "businessEvents/evt1/photo.webp")));
  });

  it("allows delete by the owner", async () => {
    await seedEvent();
    await seedObject("businessEvents/evt1/photo.webp");
    const storage = testEnv.authenticatedContext(OWNER_UID).storage();
    await assertSucceeds(deleteObject(ref(storage, "businessEvents/evt1/photo.webp")));
  });

  it("allows delete by an admin", async () => {
    await seedEvent();
    await seedObject("businessEvents/evt1/photo.webp");
    await seedAdmin();
    const storage = testEnv.authenticatedContext(ADMIN_UID).storage();
    await assertSucceeds(deleteObject(ref(storage, "businessEvents/evt1/photo.webp")));
  });
});

// umbrellaEvents/{umbrellaId} — same admin-only shape as shops, since
// umbrellaEvents are admin-managed grouping containers with no owning
// business (public read / admin-write in firestore.rules).
describe("umbrellaEvents/{umbrellaId}/{fileName}", () => {
  it("allows anyone, even unauthenticated, to read an umbrella event photo", async () => {
    await seedObject("umbrellaEvents/u1/photo.webp");
    const storage = testEnv.unauthenticatedContext().storage();
    await assertSucceeds(getBytes(ref(storage, "umbrellaEvents/u1/photo.webp")));
  });

  it("denies upload by an authenticated non-admin", async () => {
    const storage = testEnv.authenticatedContext(OTHER_UID).storage();
    await assertFails(
      uploadBytes(ref(storage, "umbrellaEvents/u1/photo.webp"), VALID_PHOTO, VALID_METADATA),
    );
  });

  it("allows upload by an admin", async () => {
    await seedAdmin();
    const storage = testEnv.authenticatedContext(ADMIN_UID).storage();
    await assertSucceeds(
      uploadBytes(ref(storage, "umbrellaEvents/u1/photo.webp"), VALID_PHOTO, VALID_METADATA),
    );
  });

  it("denies delete by a non-admin", async () => {
    await seedObject("umbrellaEvents/u1/photo.webp");
    const storage = testEnv.authenticatedContext(OTHER_UID).storage();
    await assertFails(deleteObject(ref(storage, "umbrellaEvents/u1/photo.webp")));
  });

  it("allows delete by an admin", async () => {
    await seedObject("umbrellaEvents/u1/photo.webp");
    await seedAdmin();
    const storage = testEnv.authenticatedContext(ADMIN_UID).storage();
    await assertSucceeds(deleteObject(ref(storage, "umbrellaEvents/u1/photo.webp")));
  });
});

// Any path not explicitly matched above is closed by default, including to
// an authenticated admin — same module-boundary principle as firestore's
// default-deny test.
describe("unmatched paths", () => {
  it("denies read/write on a path with no matching rule, even for an admin", async () => {
    await seedAdmin();
    const storage = testEnv.authenticatedContext(ADMIN_UID).storage();
    await assertFails(uploadBytes(ref(storage, "somewhere/else.webp"), VALID_PHOTO, VALID_METADATA));
    await assertFails(getBytes(ref(storage, "somewhere/else.webp")));
  });
});
