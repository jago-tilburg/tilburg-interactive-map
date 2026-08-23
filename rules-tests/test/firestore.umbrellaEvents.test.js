import { afterEach, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { getTestEnv } from "./testEnv.js";

const ADMIN_UID = "admin-uid";
const OTHER_UID = "other-uid";
const UMBRELLA_ID = "festival1";

let testEnv;

beforeAll(async () => {
  testEnv = await getTestEnv();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

async function seedAdmin(uid = ADMIN_UID) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "admins", uid), { email: "admin@example.com" });
  });
}

async function seedUmbrella() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "umbrellaEvents", UMBRELLA_ID), { name: "Festival" });
  });
}

describe("umbrellaEvents/{umbrellaId} read", () => {
  it("allows public, unauthenticated read", async () => {
    await seedUmbrella();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "umbrellaEvents", UMBRELLA_ID)));
  });
});

describe("umbrellaEvents/{umbrellaId} write", () => {
  it("allows an admin to create/update an umbrella event", async () => {
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(setDoc(doc(db, "umbrellaEvents", UMBRELLA_ID), { name: "Festival" }));
  });

  it("denies a non-admin authenticated user from writing", async () => {
    await seedUmbrella();
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(setDoc(doc(db, "umbrellaEvents", UMBRELLA_ID), { name: "hijacked" }));
  });

  it("denies an unauthenticated write", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "umbrellaEvents", UMBRELLA_ID), { name: "hijacked" }));
  });

  it("denies a non-admin from deleting it", async () => {
    await seedUmbrella();
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(deleteDoc(doc(db, "umbrellaEvents", UMBRELLA_ID)));
  });

  it("allows an admin to delete it", async () => {
    await seedUmbrella();
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(deleteDoc(doc(db, "umbrellaEvents", UMBRELLA_ID)));
  });
});
