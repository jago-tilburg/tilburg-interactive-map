import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFunctionsInstance = { name: "mock-functions" };
const mockCallable = vi.fn();

vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => mockFunctionsInstance),
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock("@/lib/firebase/app", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "mock-app" })),
}));

import { getFirebaseFunctions, approveEvent, rejectEvent, confirmEventPaymentStub } from "@/lib/firebase/functions";
import { getFunctions, httpsCallable } from "firebase/functions";

beforeEach(() => {
  vi.clearAllMocks();
  mockCallable.mockResolvedValue({ data: { ok: true } });
});

describe("getFirebaseFunctions", () => {
  it("gets the Functions instance bound to europe-west1", () => {
    getFirebaseFunctions();
    expect(getFunctions).toHaveBeenCalledWith({ name: "mock-app" }, "europe-west1");
  });
});

describe("approveEvent / rejectEvent / confirmEventPaymentStub", () => {
  it("approveEvent calls the approveEvent callable with the eventId", async () => {
    await approveEvent("evt1");
    expect(httpsCallable).toHaveBeenCalledWith(mockFunctionsInstance, "approveEvent");
    expect(mockCallable).toHaveBeenCalledWith({ eventId: "evt1" });
  });

  it("rejectEvent calls the rejectEvent callable with the eventId", async () => {
    await rejectEvent("evt1");
    expect(httpsCallable).toHaveBeenCalledWith(mockFunctionsInstance, "rejectEvent");
    expect(mockCallable).toHaveBeenCalledWith({ eventId: "evt1" });
  });

  it("confirmEventPaymentStub calls the confirmEventPaymentStub callable with the eventId", async () => {
    await confirmEventPaymentStub("evt1");
    expect(httpsCallable).toHaveBeenCalledWith(mockFunctionsInstance, "confirmEventPaymentStub");
    expect(mockCallable).toHaveBeenCalledWith({ eventId: "evt1" });
  });
});
