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

import {
  getFirebaseFunctions,
  createCheckoutSession,
  suspendEvent,
  restoreEvent,
  blockEvent,
  adminDeleteEvent,
} from "@/lib/firebase/functions";
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

describe("createCheckoutSession", () => {
  it("calls the createCheckoutSession callable with the eventId and returns the session URL", async () => {
    mockCallable.mockResolvedValue({ data: { url: "https://checkout.stripe.com/session123" } });

    const url = await createCheckoutSession("evt1");

    expect(httpsCallable).toHaveBeenCalledWith(mockFunctionsInstance, "createCheckoutSession");
    expect(mockCallable).toHaveBeenCalledWith({ eventId: "evt1" });
    expect(url).toBe("https://checkout.stripe.com/session123");
  });
});

describe("suspendEvent", () => {
  it("calls the suspendEvent callable with the eventId and no reason", async () => {
    await suspendEvent("evt1");
    expect(httpsCallable).toHaveBeenCalledWith(mockFunctionsInstance, "suspendEvent");
    expect(mockCallable).toHaveBeenCalledWith({ eventId: "evt1", reason: undefined });
  });

  it("passes a reason through to the callable when given", async () => {
    await suspendEvent("evt1", "Meerdere klachten");
    expect(mockCallable).toHaveBeenCalledWith({ eventId: "evt1", reason: "Meerdere klachten" });
  });
});

describe("restoreEvent", () => {
  it("calls the restoreEvent callable with the eventId", async () => {
    await restoreEvent("evt1");
    expect(httpsCallable).toHaveBeenCalledWith(mockFunctionsInstance, "restoreEvent");
    expect(mockCallable).toHaveBeenCalledWith({ eventId: "evt1" });
  });
});

describe("blockEvent", () => {
  it("calls the blockEvent callable with the eventId and no reason", async () => {
    await blockEvent("evt1");
    expect(httpsCallable).toHaveBeenCalledWith(mockFunctionsInstance, "blockEvent");
    expect(mockCallable).toHaveBeenCalledWith({ eventId: "evt1", reason: undefined });
  });

  it("passes a reason through to the callable when given", async () => {
    await blockEvent("evt1", "Nepevenement");
    expect(mockCallable).toHaveBeenCalledWith({ eventId: "evt1", reason: "Nepevenement" });
  });
});

describe("adminDeleteEvent", () => {
  it("calls the deleteEvent callable (server function name) with the eventId", async () => {
    await adminDeleteEvent("evt1");
    expect(httpsCallable).toHaveBeenCalledWith(mockFunctionsInstance, "deleteEvent");
    expect(mockCallable).toHaveBeenCalledWith({ eventId: "evt1" });
  });
});
