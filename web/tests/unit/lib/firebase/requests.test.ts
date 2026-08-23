import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = { name: "mock-db" };
const refs = new Map<string, { path: string }>();

function refFor(path: string) {
  if (!refs.has(path)) refs.set(path, { path });
  return refs.get(path)!;
}

vi.mock("firebase/database", () => ({
  getDatabase: vi.fn(() => mockDb),
  ref: vi.fn((_db, path: string) => refFor(path)),
  push: vi.fn(),
  onValue: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/firebase/app", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "mock-app" })),
}));

import { submitRequest, subscribeRequests, deleteRequest } from "@/lib/firebase/requests";
import { push, onValue, remove } from "firebase/database";

beforeEach(() => {
  vi.clearAllMocks();
  refs.clear();
});

describe("submitRequest", () => {
  it("pushes a request with the shop name, userId, and a generated id/timestamp", async () => {
    await submitRequest("Nieuwe Broodjeszaak", "u1");

    expect(push).toHaveBeenCalledWith(
      refFor("requests"),
      expect.objectContaining({ shopName: "Nieuwe Broodjeszaak", userId: "u1" }),
    );
  });
});

describe("subscribeRequests", () => {
  it("maps the keyed object into a list including each firebaseKey", () => {
    const onChange = vi.fn();
    vi.mocked(onValue).mockImplementation((_ref: unknown, next: unknown) => {
      (next as (snap: unknown) => void)({
        val: () => ({
          key1: { id: 1, shopName: "A", userId: "u1", createdAt: "t" },
        }),
      });
      return vi.fn();
    });

    subscribeRequests(onChange);

    expect(onChange).toHaveBeenCalledWith([
      { firebaseKey: "key1", id: 1, shopName: "A", userId: "u1", createdAt: "t" },
    ]);
  });

  it("returns an empty list when there is no data", () => {
    const onChange = vi.fn();
    vi.mocked(onValue).mockImplementation((_ref: unknown, next: unknown) => {
      (next as (snap: unknown) => void)({ val: () => null });
      return vi.fn();
    });

    subscribeRequests(onChange);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("forwards errors to onError", () => {
    const onError = vi.fn();
    const error = new Error("permission-denied");
    vi.mocked(onValue).mockImplementation((_ref: unknown, _next: unknown, errCb: unknown) => {
      (errCb as (e: Error) => void)(error);
      return vi.fn();
    });

    subscribeRequests(vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe("deleteRequest", () => {
  it("removes the request at requests/{firebaseKey}", async () => {
    await deleteRequest("key1");
    expect(remove).toHaveBeenCalledWith(refFor("requests/key1"));
  });
});
