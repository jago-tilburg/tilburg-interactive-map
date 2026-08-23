import { afterEach, beforeAll, describe, it } from "vitest";
import { assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { getTestEnv } from "./testEnv.js";

const ADMIN_UID = "admin-uid";

let testEnv;

beforeAll(async () => {
  testEnv = await getTestEnv();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// admins/{uid} is `allow read, write: if false` — fully closed to every
// client, including the admin themself. It exists only for other rules'
// exists() checks and is seeded/managed via the Admin SDK.
describe("admins/{uid}", () => {
  it("denies read even by the admin's own uid", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", ADMIN_UID), { email: "admin@example.com" });
    });
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertFails(getDoc(doc(db, "admins", ADMIN_UID)));
  });

  it("denies write by an authenticated user, even for their own uid", async () => {
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertFails(setDoc(doc(db, "admins", ADMIN_UID), { email: "admin@example.com" }));
  });

  it("denies delete by an authenticated user", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", ADMIN_UID), { email: "admin@example.com" });
    });
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertFails(deleteDoc(doc(db, "admins", ADMIN_UID)));
  });

  it("denies read/write by an unauthenticated user", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "admins", ADMIN_UID)));
    await assertFails(setDoc(doc(db, "admins", ADMIN_UID), { email: "x@example.com" }));
  });
});
