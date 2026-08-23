import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApp = { name: "mock-app" };

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => mockApp),
  getApps: vi.fn(),
  getApp: vi.fn(() => mockApp),
}));

vi.mock("@/lib/firebase/config", () => ({
  firebaseConfig: { projectId: "test-project" },
}));

import { getFirebaseApp } from "@/lib/firebase/app";
import { initializeApp, getApps, getApp } from "firebase/app";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getFirebaseApp", () => {
  it("initializes a new app when none exists", () => {
    vi.mocked(getApps).mockReturnValue([]);
    const app = getFirebaseApp();
    expect(initializeApp).toHaveBeenCalledWith({ projectId: "test-project" });
    expect(app).toBe(mockApp);
  });

  it("reuses the existing app instead of re-initializing", () => {
    vi.mocked(getApps).mockReturnValue([mockApp] as never);
    const app = getFirebaseApp();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(getApp).toHaveBeenCalled();
    expect(app).toBe(mockApp);
  });
});
