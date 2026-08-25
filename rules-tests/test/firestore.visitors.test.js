import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getTestEnv } from "./testEnv.js";

const UID = "visitor-uid";
const OTHER_UID = "other-uid";

const validProfile = { email: "visitor@example.com", displayName: "visitor", createdAt: Date.now() };

let testEnv;

beforeAll(async () => {
  testEnv = await getTestEnv();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

async function seedProfile(uid = UID, data = validProfile) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "visitors", uid), data);
  });
}

describe("visitors/{uid} create", () => {
  it("denies create by an unauthenticated user", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "visitors", UID), validProfile));
  });

  it("denies create for a uid other than the caller's own", async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(setDoc(doc(db, "visitors", UID), validProfile));
  });

  it("denies create missing a required field", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    const { createdAt, ...missingCreatedAt } = validProfile;
    await assertFails(setDoc(doc(db, "visitors", UID), missingCreatedAt));
  });

  it("denies create when email is not a string", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(setDoc(doc(db, "visitors", UID), { ...validProfile, email: 12345 }));
  });

  it("denies create with an unbounded-length email or displayName", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(setDoc(doc(db, "visitors", UID), { ...validProfile, email: "x".repeat(50000) + "@example.com" }));
    await assertFails(setDoc(doc(db, "visitors", UID), { ...validProfile, displayName: "x".repeat(50000) }));
  });

  it("allows the owner to create their own profile with all required fields", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(setDoc(doc(db, "visitors", UID), validProfile));
  });
});

describe("visitors/{uid} read", () => {
  it("allows the owner to read their own profile", async () => {
    await seedProfile();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(getDoc(doc(db, "visitors", UID)));
  });

  it("denies another authenticated user from reading it", async () => {
    await seedProfile();
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(db, "visitors", UID)));
  });

  it("denies an unauthenticated read", async () => {
    await seedProfile();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "visitors", UID)));
  });
});

describe("visitors/{uid} update", () => {
  it("allows the owner to update their own profile", async () => {
    await seedProfile();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(updateDoc(doc(db, "visitors", UID), { displayName: "new-name" }));
  });

  it("denies a non-owner from updating it", async () => {
    await seedProfile();
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(updateDoc(doc(db, "visitors", UID), { displayName: "hijacked" }));
  });
});

describe("visitors/{uid} delete", () => {
  it("allows the owner to delete their own profile", async () => {
    await seedProfile();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(deleteDoc(doc(db, "visitors", UID)));
  });

  it("denies a non-owner from deleting it", async () => {
    await seedProfile();
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(deleteDoc(doc(db, "visitors", UID)));
  });
});
