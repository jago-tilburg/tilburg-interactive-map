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
  subscribeUmbrellaEvents,
  createUmbrellaEvent,
  updateUmbrellaEvent,
  deleteUmbrellaEvent,
} from "@/lib/firebase/umbrellaEvents";
import { onSnapshot, addDoc, updateDoc, deleteDoc } from "firebase/firestore";

beforeEach(() => {
  vi.clearAllMocks();
  docRefs.clear();
});

describe("subscribeUmbrellaEvents", () => {
  it("maps snapshot docs with id", () => {
    const onChange = vi.fn();
    vi.mocked(onSnapshot).mockImplementation((_ref: unknown, next: unknown) => {
      (next as (snap: unknown) => void)({
        docs: [{ id: "u1", data: () => ({ title: "Kermis" }) }],
      });
      return vi.fn();
    });

    subscribeUmbrellaEvents(onChange);

    expect(onChange).toHaveBeenCalledWith([{ id: "u1", title: "Kermis" }]);
  });

  it("forwards errors to onError", () => {
    const onError = vi.fn();
    const error = new Error("boom");
    vi.mocked(onSnapshot).mockImplementation((_ref: unknown, _next: unknown, errCb: unknown) => {
      (errCb as (e: Error) => void)(error);
      return vi.fn();
    });

    subscribeUmbrellaEvents(vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe("createUmbrellaEvent", () => {
  it("writes a serverTimestamp createdAt alongside the input", async () => {
    await createUmbrellaEvent({
      title: "Kermis",
      description: "",
      color: "#b45309",
      startDate: "2026-09-01",
      endDate: "2026-09-10",
    });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: "Kermis", createdAt: "SERVER_TIMESTAMP" }),
    );
  });
});

describe("updateUmbrellaEvent", () => {
  it("updates the umbrellaEvents/{id} doc", async () => {
    await updateUmbrellaEvent("u1", {
      title: "Kermis 2",
      description: "",
      color: "#b45309",
      startDate: "2026-09-01",
      endDate: "2026-09-10",
    });

    expect(updateDoc).toHaveBeenCalledWith(
      docRef("umbrellaEvents/u1"),
      expect.objectContaining({ title: "Kermis 2" }),
    );
  });
});

describe("deleteUmbrellaEvent", () => {
  it("deletes the umbrellaEvents/{id} doc", async () => {
    await deleteUmbrellaEvent("u1");
    expect(deleteDoc).toHaveBeenCalledWith(docRef("umbrellaEvents/u1"));
  });
});
