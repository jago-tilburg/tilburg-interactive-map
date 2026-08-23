import { afterEach, beforeAll, describe, it } from "vitest";
import { assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getTestEnv } from "./testEnv.js";

const ADMIN_UID = "admin-uid";

let testEnv;

beforeAll(async () => {
  testEnv = await getTestEnv();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// Any collection not explicitly matched above is closed by default,
// including to an authenticated admin — this is the catch-all module
// boundary future collections must be deliberately opened up from.
describe("unmatched collections", () => {
  it("denies read/write on a collection with no matching rule, even for an admin", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", ADMIN_UID), { email: "admin@example.com" });
    });
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertFails(getDoc(doc(db, "shops", "shop1")));
    await assertFails(setDoc(doc(db, "shops", "shop1"), { name: "New Shop" }));
  });
});
