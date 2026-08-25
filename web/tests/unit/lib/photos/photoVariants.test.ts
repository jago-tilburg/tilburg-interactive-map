import { describe, it, expect } from "vitest";
import { isOwnStoragePhotoUrl, photoVariantUrl } from "@/lib/photos/photoVariants";

const OWN_URL = "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/shops%2F1%2Fabc.webp?alt=media";
const EXTERNAL_URL = "https://example.com/photo.jpg";

describe("isOwnStoragePhotoUrl", () => {
  it("recognizes a Firebase Storage download URL", () => {
    expect(isOwnStoragePhotoUrl(OWN_URL)).toBe(true);
  });

  it("rejects an external URL", () => {
    expect(isOwnStoragePhotoUrl(EXTERNAL_URL)).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isOwnStoragePhotoUrl("")).toBe(false);
  });
});

describe("photoVariantUrl", () => {
  it("inserts the _thumb suffix before .webp for an own-storage URL", () => {
    expect(photoVariantUrl(OWN_URL, "thumb")).toBe(
      "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/shops%2F1%2Fabc_thumb.webp?alt=media",
    );
  });

  it("inserts the _detail suffix before .webp for an own-storage URL", () => {
    expect(photoVariantUrl(OWN_URL, "detail")).toBe(
      "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/shops%2F1%2Fabc_detail.webp?alt=media",
    );
  });

  it("handles an own-storage URL with no query string", () => {
    expect(photoVariantUrl("https://firebasestorage.googleapis.com/v0/b/test-bucket/o/x.webp", "thumb")).toBe(
      "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/x_thumb.webp",
    );
  });

  it("passes an external URL through unchanged", () => {
    expect(photoVariantUrl(EXTERNAL_URL, "thumb")).toBe(EXTERNAL_URL);
  });

  it("passes an empty string through unchanged", () => {
    expect(photoVariantUrl("", "detail")).toBe("");
  });
});
