import { afterEach, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getTestEnv } from "./testEnv.js";

const ADMIN_UID = "admin-uid";
const OTHER_UID = "other-uid";
const REPORT_ID = "shop_9001_anon-1";

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

async function seedReport(overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "reports", REPORT_ID), {
      contentType: "shop",
      contentId: "9001",
      reporterId: "anon-1",
      reason: "spam",
      createdAt: "t",
      status: "open",
      ...overrides,
    });
  });
}

const validReport = {
  contentType: "shop",
  contentId: "9001",
  reporterId: "anon-1",
  reason: "spam",
  createdAt: "t",
  status: "open",
};

describe("reports/{reportId} create (anyone, including unauthenticated)", () => {
  it("allows an unauthenticated caller to file a valid report", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(setDoc(doc(db, "reports", REPORT_ID), validReport));
  });

  it("allows an optional details field within the length cap", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(setDoc(doc(db, "reports", REPORT_ID), { ...validReport, details: "Verkeerde locatie" }));
  });

  it("denies a report missing a required field", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const { reason, ...missingReason } = validReport;
    void reason;
    await assertFails(setDoc(doc(db, "reports", REPORT_ID), missingReason));
  });

  it("denies an invalid contentType", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "reports", REPORT_ID), { ...validReport, contentType: "somethingElse" }));
  });

  it("denies an invalid reason", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "reports", REPORT_ID), { ...validReport, reason: "made-up-reason" }));
  });

  it("denies details over the length cap", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "reports", REPORT_ID), { ...validReport, details: "x".repeat(1001) }));
  });

  it("denies a direct write that sets status to resolved", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "reports", REPORT_ID), { ...validReport, status: "resolved" }));
  });

  it("denies a direct write that forges resolvedAt", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "reports", REPORT_ID), { ...validReport, resolvedAt: "fake" }));
  });

  it("denies a direct write that forges resolvedBy", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "reports", REPORT_ID), { ...validReport, resolvedBy: OTHER_UID }));
  });
});

describe("reports/{reportId} re-filing (same deterministic id)", () => {
  it("lets anyone reopen a previously resolved report by re-filing at the same id", async () => {
    await seedReport({ status: "resolved", resolvedAt: "t", resolvedBy: ADMIN_UID });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(setDoc(doc(db, "reports", REPORT_ID), validReport));
  });
});

describe("reports/{reportId} read", () => {
  it("denies an unauthenticated read", async () => {
    await seedReport();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "reports", REPORT_ID)));
  });

  it("denies a non-admin authenticated read", async () => {
    await seedReport();
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(db, "reports", REPORT_ID)));
  });

  it("allows an admin to read", async () => {
    await seedReport();
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(getDoc(doc(db, "reports", REPORT_ID)));
  });
});

describe("reports/{reportId} resolve/dismiss", () => {
  it("denies a non-admin from resolving", async () => {
    await seedReport();
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(
      updateDoc(doc(db, "reports", REPORT_ID), { status: "resolved", resolvedAt: "t", resolvedBy: OTHER_UID }),
    );
  });

  it("denies an unauthenticated caller from resolving", async () => {
    await seedReport();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      updateDoc(doc(db, "reports", REPORT_ID), { status: "resolved", resolvedAt: "t", resolvedBy: "x" }),
    );
  });

  it("allows an admin to resolve, touching only status/resolvedAt/resolvedBy", async () => {
    await seedReport();
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, "reports", REPORT_ID), { status: "resolved", resolvedAt: "t", resolvedBy: ADMIN_UID }),
    );
  });

  it("allows an admin to dismiss", async () => {
    await seedReport();
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, "reports", REPORT_ID), { status: "dismissed", resolvedAt: "t", resolvedBy: ADMIN_UID }),
    );
  });

  it("denies an admin resolve that also sneaks in a change to another field", async () => {
    await seedReport();
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertFails(
      updateDoc(doc(db, "reports", REPORT_ID), {
        status: "resolved",
        resolvedAt: "t",
        resolvedBy: ADMIN_UID,
        reason: "other",
      }),
    );
  });
});

describe("reports/{reportId} delete", () => {
  it("denies delete even for an admin", async () => {
    await seedReport();
    await seedAdmin();
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertFails(deleteDoc(doc(db, "reports", REPORT_ID)));
  });
});
