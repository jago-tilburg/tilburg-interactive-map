import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = { name: "mock-db" };

vi.mock("firebase/database", () => ({
  getDatabase: vi.fn(() => mockDb),
  ref: vi.fn((_db, path: string) => ({ path })),
  get: vi.fn(),
}));

vi.mock("@/lib/firebase/app", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "mock-app" })),
}));

import { isUidAdmin } from "@/lib/firebase/admin";
import { get } from "firebase/database";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isUidAdmin", () => {
  // Real RTDB adminUsers shape, confirmed live on staging: an array of uids
  // (the legacy monolith's adminUsers array-membership check, which this
  // reads directly rather than the Firestore admins/{uid} collection —
  // that one is `allow read, write: if false` for everyone, including the
  // admin's own uid, so it can never be read from the client at all).
  it("returns true when the uid is in the adminUsers array", async () => {
    vi.mocked(get).mockResolvedValue({ val: () => ["admin-uid", "other-admin"] } as never);
    expect(await isUidAdmin("admin-uid")).toBe(true);
  });

  it("returns false when the uid is not in the adminUsers array", async () => {
    vi.mocked(get).mockResolvedValue({ val: () => ["admin-uid"] } as never);
    expect(await isUidAdmin("regular-uid")).toBe(false);
  });

  it("returns false when adminUsers is empty/missing", async () => {
    vi.mocked(get).mockResolvedValue({ val: () => null } as never);
    expect(await isUidAdmin("regular-uid")).toBe(false);
  });

  // Defensive: also handle an object-map shape ({uid: true}), since that's
  // what a plain seed script would naturally write and what the rules-tests
  // suite seeds — don't assume the array shape is the only one ever used.
  it("returns true for an object-map shape ({uid: true})", async () => {
    vi.mocked(get).mockResolvedValue({ val: () => ({ "admin-uid": true }) } as never);
    expect(await isUidAdmin("admin-uid")).toBe(true);
  });
});
