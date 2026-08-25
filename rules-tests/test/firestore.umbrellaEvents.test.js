import { afterEach, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, getDoc, deleteDoc } from "firebase/firestore";
import { getTestEnv } from "./testEnv.js";

const ADMIN_UID = "admin-uid";
const OTHER_UID = "other-uid";
const UMBRELLA_ID = "festival1";

function validUmbrella(overrides = {}) {
  return {
    title: "Tilburgse Kermis",
    description: "Jaarlijkse kermis",
    color: "#b45309",
    startDate: "2026-07-01",
    endDate: "2026-07-10",
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

async function seedAdmin(uid = ADMIN_UID) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "admins", uid), { email: "admin@example.com" });
  });
}

async function seedUmbrella(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "umbrellaEvents", UMBRELLA_ID), validUmbrella(overrides));
  });
}

describe("umbrellaEvents/{umbrellaId} read", () => {
  it("allows public, unauthenticated read", async () => {
    await seedUmbrella();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "umbrellaEvents", UMBRELLA_ID)));
  });
});

describe("umbrellaEvents/{umbrellaId} create", () => {
  it("allows an admin to create an umbrella event with all required fields", async () => {
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(setDoc(doc(db, "umbrellaEvents", UMBRELLA_ID), validUmbrella()));
  });

  it("denies a non-admin authenticated user from creating one", async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(setDoc(doc(db, "umbrellaEvents", UMBRELLA_ID), validUmbrella()));
  });

  it("denies an unauthenticated create", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "umbrellaEvents", UMBRELLA_ID), validUmbrella()));
  });

  it("denies create missing a required field", async () => {
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    const { color, ...missingColor } = validUmbrella();
    await assertFails(setDoc(doc(db, "umbrellaEvents", UMBRELLA_ID), missingColor));
  });

  it("denies create with wrong-typed fields", async () => {
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertFails(setDoc(doc(db, "umbrellaEvents", UMBRELLA_ID), validUmbrella({ title: { nested: true } })));
  });

  it("denies create with an unbounded-length title", async () => {
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertFails(setDoc(doc(db, "umbrellaEvents", UMBRELLA_ID), validUmbrella({ title: "x".repeat(50000) })));
  });
});

describe("umbrellaEvents/{umbrellaId} update", () => {
  it("allows an admin to update it", async () => {
    await seedUmbrella();
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(updateDoc(doc(db, "umbrellaEvents", UMBRELLA_ID), validUmbrella({ title: "Updated" })));
  });

  it("denies a non-admin from updating it", async () => {
    await seedUmbrella();
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(updateDoc(doc(db, "umbrellaEvents", UMBRELLA_ID), validUmbrella({ title: "hijacked" })));
  });
});

describe("umbrellaEvents/{umbrellaId} delete", () => {
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
