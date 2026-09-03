import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockStorage = { name: "mock-storage" };
const getStorage = vi.fn((..._args: unknown[]) => mockStorage);
const ref = vi.fn();
const uploadBytesResumable = vi.fn();
const getDownloadURL = vi.fn();
const deleteObject = vi.fn();

vi.mock("firebase/storage", () => ({
  getStorage: (...a: unknown[]) => getStorage(...a),
  ref: (...a: unknown[]) => ref(...a),
  uploadBytesResumable: (...a: unknown[]) => uploadBytesResumable(...a),
  getDownloadURL: (...a: unknown[]) => getDownloadURL(...a),
  deleteObject: (...a: unknown[]) => deleteObject(...a),
}));

vi.mock("@/lib/firebase/app", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "mock-app" })),
}));

import { getPhotoStorage, uploadPhoto, deleteOwnPhoto, UNAUTHORIZED_RETRY_DELAYS_MS } from "@/lib/firebase/storage";

function makeFakeTask(outcome: "success" | "error", error: unknown = new Error("upload failed")) {
  return {
    snapshot: { ref: "fake-object-ref" },
    on: (
      _event: string,
      onProgress: (s: { bytesTransferred: number; totalBytes: number }) => void,
      onError: (err: unknown) => void,
      onComplete: () => void,
    ) => {
      queueMicrotask(() => {
        onProgress({ bytesTransferred: 50, totalBytes: 100 });
        if (outcome === "success") onComplete();
        else onError(error);
      });
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  ref.mockImplementation((_storage: unknown, path: string) => ({ path }));
  vi.stubGlobal("crypto", { randomUUID: () => "fixed-uuid" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getPhotoStorage", () => {
  it("returns a Storage instance bound to the shared Firebase app", () => {
    expect(getPhotoStorage()).toBe(mockStorage);
    expect(getStorage).toHaveBeenCalledWith({ name: "mock-app" });
  });
});

describe("uploadPhoto", () => {
  it("uploads to {kind}/{id}/{uuid}.webp and resolves with the download URL, reporting progress", async () => {
    uploadBytesResumable.mockReturnValue(makeFakeTask("success"));
    getDownloadURL.mockResolvedValue("https://storage.example/shops/9001/fixed-uuid.webp");
    const onProgress = vi.fn();
    const blob = new Blob(["x"], { type: "image/webp" });

    const url = await uploadPhoto("shops", 9001, blob, onProgress);

    expect(ref).toHaveBeenCalledWith(mockStorage, "shops/9001/fixed-uuid.webp");
    expect(uploadBytesResumable).toHaveBeenCalledWith({ path: "shops/9001/fixed-uuid.webp" }, blob, {
      contentType: "image/webp",
    });
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(getDownloadURL).toHaveBeenCalledWith("fake-object-ref");
    expect(url).toBe("https://storage.example/shops/9001/fixed-uuid.webp");
  });

  it("works without an onProgress callback", async () => {
    uploadBytesResumable.mockReturnValue(makeFakeTask("success"));
    getDownloadURL.mockResolvedValue("https://storage.example/businessEvents/evt1/fixed-uuid.webp");

    const url = await uploadPhoto("businessEvents", "evt1", new Blob(["x"]));

    expect(url).toBe("https://storage.example/businessEvents/evt1/fixed-uuid.webp");
  });

  it("rejects when the upload task itself errors", async () => {
    uploadBytesResumable.mockReturnValue(makeFakeTask("error"));

    await expect(uploadPhoto("umbrellaEvents", "u1", new Blob(["x"]))).rejects.toThrow("upload failed");
    expect(getDownloadURL).not.toHaveBeenCalled();
  });

  it("retries a transient storage/unauthorized (the parent doc not yet visible to Storage Rules) and succeeds", async () => {
    vi.useFakeTimers();
    try {
      uploadBytesResumable
        .mockReturnValueOnce(makeFakeTask("error", { code: "storage/unauthorized" }))
        .mockReturnValueOnce(makeFakeTask("success"));
      getDownloadURL.mockResolvedValue("https://storage.example/businessEvents/evt1/fixed-uuid.webp");

      const promise = uploadPhoto("businessEvents", "evt1", new Blob(["x"]));
      await vi.advanceTimersByTimeAsync(UNAUTHORIZED_RETRY_DELAYS_MS[0]);

      await expect(promise).resolves.toBe("https://storage.example/businessEvents/evt1/fixed-uuid.webp");
      expect(uploadBytesResumable).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up after exhausting all retries and rejects with the final storage/unauthorized error", async () => {
    vi.useFakeTimers();
    try {
      uploadBytesResumable.mockImplementation(() => makeFakeTask("error", { code: "storage/unauthorized" }));

      const promise = uploadPhoto("businessEvents", "evt1", new Blob(["x"]));
      const assertion = expect(promise).rejects.toEqual({ code: "storage/unauthorized" });
      for (const delay of UNAUTHORIZED_RETRY_DELAYS_MS) {
        await vi.advanceTimersByTimeAsync(delay);
      }
      await assertion;

      expect(uploadBytesResumable).toHaveBeenCalledTimes(UNAUTHORIZED_RETRY_DELAYS_MS.length + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry a non-unauthorized error even if it has an unrelated .code", async () => {
    uploadBytesResumable.mockReturnValue(makeFakeTask("error", { code: "storage/quota-exceeded" }));

    await expect(uploadPhoto("businessEvents", "evt1", new Blob(["x"]))).rejects.toEqual({
      code: "storage/quota-exceeded",
    });
    expect(uploadBytesResumable).toHaveBeenCalledTimes(1);
  });
});

describe("deleteOwnPhoto", () => {
  it("no-ops on an empty URL without ever calling ref()", async () => {
    await deleteOwnPhoto("");
    expect(ref).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("no-ops on a URL that isn't one of our own Storage objects (ref() throws)", async () => {
    ref.mockImplementation(() => {
      throw new Error("Firebase Storage: Invalid URL");
    });

    await deleteOwnPhoto("https://example.com/business-supplied-photo.jpg");

    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("deletes a recognized own-Storage URL", async () => {
    deleteObject.mockResolvedValue(undefined);

    await deleteOwnPhoto("https://firebasestorage.googleapis.com/v0/b/bucket/o/shops%2F9001%2Fold.webp");

    expect(deleteObject).toHaveBeenCalledWith({
      path: "https://firebasestorage.googleapis.com/v0/b/bucket/o/shops%2F9001%2Fold.webp",
    });
  });

  it("swallows a storage/object-not-found error (already deleted, or never existed)", async () => {
    deleteObject.mockRejectedValue({ code: "storage/object-not-found" });

    await expect(deleteOwnPhoto("https://firebasestorage.googleapis.com/v0/b/bucket/o/gone.webp")).resolves.toBeUndefined();
  });

  it("rethrows any other delete error", async () => {
    deleteObject.mockRejectedValue({ code: "storage/unauthorized" });

    await expect(deleteOwnPhoto("https://firebasestorage.googleapis.com/v0/b/bucket/o/locked.webp")).rejects.toEqual({
      code: "storage/unauthorized",
    });
  });
});
