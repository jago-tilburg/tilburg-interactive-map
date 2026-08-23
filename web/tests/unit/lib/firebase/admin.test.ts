import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({ name: "mock-db" })),
  doc: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}` })),
  getDoc: vi.fn(),
}));

vi.mock("@/lib/firebase/app", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "mock-app" })),
}));

import { isUidAdmin } from "@/lib/firebase/admin";
import { getDoc } from "firebase/firestore";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isUidAdmin", () => {
  it("returns true when an admins/{uid} doc exists", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true } as never);
    expect(await isUidAdmin("admin-uid")).toBe(true);
  });

  it("returns false when no admins/{uid} doc exists", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
    expect(await isUidAdmin("regular-uid")).toBe(false);
  });
});
