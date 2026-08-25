import { describe, it, expect, vi, beforeEach } from "vitest";

const uploadPhoto = vi.fn();
const deleteOwnPhoto = vi.fn();
vi.mock("@/lib/firebase/storage", () => ({
  uploadPhoto: (...a: unknown[]) => uploadPhoto(...a),
  deleteOwnPhoto: (...a: unknown[]) => deleteOwnPhoto(...a),
}));

import { resolvePhotoUpdate } from "@/lib/photos/resolvePhotoUpdate";

beforeEach(() => {
  vi.clearAllMocks();
  deleteOwnPhoto.mockResolvedValue(undefined);
});

describe("resolvePhotoUpdate", () => {
  it("returns the previous URL unchanged when there's no pending photo action", async () => {
    const result = await resolvePhotoUpdate("shops", 1, null, "https://storage.example/shops/1/current.webp");

    expect(result).toBe("https://storage.example/shops/1/current.webp");
    expect(uploadPhoto).not.toHaveBeenCalled();
    expect(deleteOwnPhoto).not.toHaveBeenCalled();
  });

  it("uploads a replacement, then best-effort deletes the previous own-Storage photo, and returns the new URL", async () => {
    const blob = new Blob(["x"]);
    uploadPhoto.mockResolvedValue("https://storage.example/shops/1/new.webp");

    const result = await resolvePhotoUpdate(
      "shops",
      1,
      { action: "replace", blob, previewUrl: "blob:preview" },
      "https://storage.example/shops/1/old.webp",
    );

    expect(uploadPhoto).toHaveBeenCalledWith("shops", 1, blob);
    expect(deleteOwnPhoto).toHaveBeenCalledWith("https://storage.example/shops/1/old.webp");
    expect(result).toBe("https://storage.example/shops/1/new.webp");
  });

  it("deletes the previous own-Storage photo and returns an empty URL on remove", async () => {
    const result = await resolvePhotoUpdate("shops", 1, { action: "remove" }, "https://storage.example/shops/1/old.webp");

    expect(deleteOwnPhoto).toHaveBeenCalledWith("https://storage.example/shops/1/old.webp");
    expect(uploadPhoto).not.toHaveBeenCalled();
    expect(result).toBe("");
  });

  it("swallows a delete-cleanup failure on replace — the new upload already succeeded", async () => {
    uploadPhoto.mockResolvedValue("https://storage.example/shops/1/new.webp");
    deleteOwnPhoto.mockRejectedValue(new Error("cleanup failed"));

    await expect(
      resolvePhotoUpdate("shops", 1, { action: "replace", blob: new Blob(["x"]), previewUrl: "x" }, "old-url"),
    ).resolves.toBe("https://storage.example/shops/1/new.webp");
  });

  it("swallows a delete-cleanup failure on remove — the record is still marked as having no photo", async () => {
    deleteOwnPhoto.mockRejectedValue(new Error("cleanup failed"));

    await expect(resolvePhotoUpdate("shops", 1, { action: "remove" }, "old-url")).resolves.toBe("");
  });

  it("propagates an upload failure on replace (the previous photo is left untouched)", async () => {
    uploadPhoto.mockRejectedValue(new Error("upload failed"));

    await expect(
      resolvePhotoUpdate("shops", 1, { action: "replace", blob: new Blob(["x"]), previewUrl: "x" }, "old-url"),
    ).rejects.toThrow("upload failed");
    expect(deleteOwnPhoto).not.toHaveBeenCalled();
  });
});
