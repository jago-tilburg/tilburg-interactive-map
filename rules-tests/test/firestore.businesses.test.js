import { afterEach, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getTestEnv } from "./testEnv.js";

const UID = "business-uid";
const OTHER_UID = "other-uid";

const validProfile = { businessName: "My Shop", email: "biz@example.com", createdAt: Date.now() };

let testEnv;

beforeAll(async () => {
  testEnv = await getTestEnv();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

async function seedProfile(uid = UID, data = validProfile) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "businesses", uid), data);
  });
}

describe("businesses/{uid} create", () => {
  it("denies create by an unauthenticated user", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "businesses", UID), validProfile));
  });

  it("denies create for a uid other than the caller's own", async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(setDoc(doc(db, "businesses", UID), validProfile));
  });

  it("denies create missing a required field", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    const { businessName, ...missingName } = validProfile;
    await assertFails(setDoc(doc(db, "businesses", UID), missingName));
  });

  it("denies create when businessName is not a string", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(setDoc(doc(db, "businesses", UID), { ...validProfile, businessName: 42 }));
  });

  it("denies create with an unbounded-length businessName or email", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(setDoc(doc(db, "businesses", UID), { ...validProfile, businessName: "x".repeat(50000) }));
    await assertFails(setDoc(doc(db, "businesses", UID), { ...validProfile, email: "x".repeat(50000) + "@example.com" }));
  });

  it("allows the owner to create their own profile with all required fields", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(setDoc(doc(db, "businesses", UID), validProfile));
  });

  // The dual-role model (PLAN-INLOGGEN.md §6): everyone who signs in gets a
  // visitors/{uid} doc first, and an event-profile is added on top of that
  // same account later — an existing visitor profile at this uid must never
  // block creating a business one.
  it("allows create on a uid that already has a visitor profile", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "visitors", UID), {
        email: "biz@example.com",
        displayName: "biz",
        createdAt: Date.now(),
      });
    });
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(setDoc(doc(db, "businesses", UID), validProfile));
  });
});

describe("businesses/{uid} read", () => {
  it("allows the owner to read their own profile", async () => {
    await seedProfile();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(getDoc(doc(db, "businesses", UID)));
  });

  it("denies another authenticated user from reading it", async () => {
    await seedProfile();
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(db, "businesses", UID)));
  });

  it("denies an unauthenticated read", async () => {
    await seedProfile();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "businesses", UID)));
  });
});

describe("businesses/{uid} update", () => {
  it("allows the owner to update their own profile", async () => {
    await seedProfile();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(updateDoc(doc(db, "businesses", UID), { businessName: "New Name" }));
  });

  it("denies a non-owner from updating it", async () => {
    await seedProfile();
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(updateDoc(doc(db, "businesses", UID), { businessName: "hijacked" }));
  });
});

describe("businesses/{uid} delete", () => {
  it("allows the owner to delete their own profile", async () => {
    await seedProfile();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(deleteDoc(doc(db, "businesses", UID)));
  });

  it("denies a non-owner from deleting it", async () => {
    await seedProfile();
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(deleteDoc(doc(db, "businesses", UID)));
  });
});
