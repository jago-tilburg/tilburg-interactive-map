import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = { name: "mock-db" };
const docRefs = new Map<string, { path: string }>();

function docRef(path: string) {
  if (!docRefs.has(path)) docRefs.set(path, { path });
  return docRefs.get(path)!;
}

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => mockDb),
  collection: vi.fn((_db, name) => ({ name })),
  doc: vi.fn((_db, collectionName, id) => docRef(`${collectionName}/${id}`)),
  query: vi.fn((collectionRef, ...clauses) => ({ collectionRef, clauses })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
}));

vi.mock("@/lib/firebase/app", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "mock-app" })),
}));

import {
  subscribeApprovedBusinessEvents,
  subscribeMyBusinessEvents,
  subscribeAllBusinessEventsForAdmin,
  createBusinessEvent,
  updateBusinessEvent,
  deleteBusinessEvent,
} from "@/lib/firebase/businessEvents";
import { onSnapshot, addDoc, updateDoc, deleteDoc, where } from "firebase/firestore";

beforeEach(() => {
  vi.clearAllMocks();
  docRefs.clear();
});

const docSnap = (id: string, data: object) => ({ id, data: () => data });

describe("subscribeApprovedBusinessEvents", () => {
  it("queries status == approved and maps snapshot docs with id", () => {
    const onChange = vi.fn();
    vi.mocked(onSnapshot).mockImplementation((_q: unknown, next: unknown) => {
      (next as (snap: unknown) => void)({ docs: [docSnap("evt1", { title: "Test" })] });
      return vi.fn();
    });

    subscribeApprovedBusinessEvents(onChange);

    expect(where).toHaveBeenCalledWith("status", "==", "approved");
    expect(onChange).toHaveBeenCalledWith([{ id: "evt1", title: "Test" }]);
  });

  it("forwards errors to onError", () => {
    const onError = vi.fn();
    const error = new Error("boom");
    vi.mocked(onSnapshot).mockImplementation((_q: unknown, _next: unknown, errCb: unknown) => {
      (errCb as (e: Error) => void)(error);
      return vi.fn();
    });

    subscribeApprovedBusinessEvents(vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe("subscribeMyBusinessEvents", () => {
  it("queries ownerId == uid", () => {
    vi.mocked(onSnapshot).mockImplementation((_q: unknown, next: unknown) => {
      (next as (snap: unknown) => void)({ docs: [] });
      return vi.fn();
    });

    subscribeMyBusinessEvents("owner-uid", vi.fn());

    expect(where).toHaveBeenCalledWith("ownerId", "==", "owner-uid");
  });

  it("forwards errors to onError", () => {
    const onError = vi.fn();
    const error = new Error("boom");
    vi.mocked(onSnapshot).mockImplementation((_q: unknown, _next: unknown, errCb: unknown) => {
      (errCb as (e: Error) => void)(error);
      return vi.fn();
    });

    subscribeMyBusinessEvents("owner-uid", vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe("subscribeAllBusinessEventsForAdmin", () => {
  it("subscribes to the whole collection with no filter", () => {
    const onChange = vi.fn();
    vi.mocked(onSnapshot).mockImplementation((_ref: unknown, next: unknown) => {
      (next as (snap: unknown) => void)({ docs: [docSnap("evt1", { title: "A" })] });
      return vi.fn();
    });

    subscribeAllBusinessEventsForAdmin(onChange);

    expect(onChange).toHaveBeenCalledWith([{ id: "evt1", title: "A" }]);
  });

  it("forwards errors to onError", () => {
    const onError = vi.fn();
    const error = new Error("boom");
    vi.mocked(onSnapshot).mockImplementation((_ref: unknown, _next: unknown, errCb: unknown) => {
      (errCb as (e: Error) => void)(error);
      return vi.fn();
    });

    subscribeAllBusinessEventsForAdmin(vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe("createBusinessEvent", () => {
  it("writes ownerId, pending status, unpaid, and a serverTimestamp createdAt", async () => {
    await createBusinessEvent("owner-uid", {
      title: "Test",
      category: "eten",
      description: "desc",
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      startTime: "10:00",
      endTime: "18:00",
      address: "Somewhere 1",
      lat: 51.5,
      lng: 5.09,
    });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "Test",
        ownerId: "owner-uid",
        status: "pending",
        paid: false,
        createdAt: "SERVER_TIMESTAMP",
      }),
    );
  });
});

describe("updateBusinessEvent", () => {
  const baseInput = {
    title: "Updated",
    category: "eten" as const,
    description: "desc",
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    startTime: "10:00",
    endTime: "18:00",
    address: "Somewhere 1",
    lat: 51.5,
    lng: 5.09,
  };

  it("does not touch status when pullBackToPending is false", async () => {
    await updateBusinessEvent("evt1", baseInput, { pullBackToPending: false });

    expect(updateDoc).toHaveBeenCalledWith(
      docRef("businessEvents/evt1"),
      expect.not.objectContaining({ status: expect.anything() }),
    );
  });

  it("sets status back to pending when pullBackToPending is true", async () => {
    await updateBusinessEvent("evt1", baseInput, { pullBackToPending: true });

    expect(updateDoc).toHaveBeenCalledWith(
      docRef("businessEvents/evt1"),
      expect.objectContaining({ status: "pending" }),
    );
  });
});

describe("deleteBusinessEvent", () => {
  it("deletes the businessEvents/{id} doc", async () => {
    await deleteBusinessEvent("evt1");
    expect(deleteDoc).toHaveBeenCalledWith(docRef("businessEvents/evt1"));
  });
});
