import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = { name: "mock-db" };
const docRefs = new Map<string, { path: string }>();

function docRef(path: string) {
  if (!docRefs.has(path)) docRefs.set(path, { path });
  return docRefs.get(path)!;
}

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => mockDb),
  doc: vi.fn((_db, collection, id) => docRef(`${collection}/${id}`)),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  writeBatch: vi.fn(),
  collection: vi.fn((_db, name) => ({ name })),
  query: vi.fn((...args) => ({ args })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  getDocs: vi.fn(),
}));

vi.mock("@/lib/firebase/app", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "mock-app" })),
}));

import {
  getVisitorProfile,
  createVisitorProfile,
  deleteVisitorProfile,
  getBusinessProfile,
  createBusinessProfile,
  deleteBusinessAccountCascade,
} from "@/lib/firebase/firestore";
import { getDoc, setDoc, deleteDoc, getDocs, writeBatch } from "firebase/firestore";

beforeEach(() => {
  vi.clearAllMocks();
  docRefs.clear();
});

describe("getVisitorProfile", () => {
  it("returns null when the doc does not exist", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
    expect(await getVisitorProfile("uid1")).toBeNull();
  });

  it("returns the profile with uid when the doc exists", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ email: "a@b.com", displayName: "a", createdAt: "ts" }),
    } as never);
    expect(await getVisitorProfile("uid1")).toEqual({
      uid: "uid1",
      email: "a@b.com",
      displayName: "a",
      createdAt: "ts",
    });
  });
});

describe("createVisitorProfile", () => {
  it("writes email/displayName/createdAt with serverTimestamp and derives displayName from email", async () => {
    const profile = await createVisitorProfile("uid1", "someone@example.com");
    expect(setDoc).toHaveBeenCalledWith(
      docRef("visitors/uid1"),
      expect.objectContaining({
        email: "someone@example.com",
        displayName: "someone",
        createdAt: "SERVER_TIMESTAMP",
      }),
    );
    expect(profile).toMatchObject({ uid: "uid1", displayName: "someone" });
  });

  it("falls back to 'Bezoeker' when email is empty", async () => {
    const profile = await createVisitorProfile("uid2", "");
    expect(profile.displayName).toBe("Bezoeker");
  });
});

describe("deleteVisitorProfile", () => {
  it("deletes the visitors/{uid} doc", async () => {
    await deleteVisitorProfile("uid1");
    expect(deleteDoc).toHaveBeenCalledWith(docRef("visitors/uid1"));
  });
});

describe("getBusinessProfile / createBusinessProfile", () => {
  it("returns null when absent", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
    expect(await getBusinessProfile("uid1")).toBeNull();
  });

  it("returns the profile with uid when the doc exists", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ businessName: "My Shop", email: "biz@example.com", createdAt: "ts" }),
    } as never);
    expect(await getBusinessProfile("uid1")).toEqual({
      uid: "uid1",
      businessName: "My Shop",
      email: "biz@example.com",
      createdAt: "ts",
    });
  });

  it("writes businessName/email/createdAt on create", async () => {
    await createBusinessProfile("uid1", "My Shop", "shop@example.com");
    expect(setDoc).toHaveBeenCalledWith(
      docRef("businesses/uid1"),
      { businessName: "My Shop", email: "shop@example.com", createdAt: "SERVER_TIMESTAMP" },
    );
  });
});

describe("deleteBusinessAccountCascade", () => {
  it("batch-deletes owned businessEvents and the business doc", async () => {
    const fakeEventRef = { path: "businessEvents/evt1" };
    vi.mocked(getDocs).mockResolvedValue({
      forEach: (cb: (d: { ref: unknown }) => void) => cb({ ref: fakeEventRef }),
    } as never);
    const batchDelete = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    vi.mocked(writeBatch).mockReturnValue({ delete: batchDelete, commit: batchCommit } as never);

    await deleteBusinessAccountCascade("uid1");

    expect(batchDelete).toHaveBeenCalledWith(fakeEventRef);
    expect(batchDelete).toHaveBeenCalledWith(docRef("businesses/uid1"));
    expect(batchCommit).toHaveBeenCalled();
  });
});
