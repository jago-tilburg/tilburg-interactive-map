import { describe, it, expect, vi, afterEach } from "vitest";
import { validatePhotoFile, loadImageDimensions, isLargeEnough, MIN_DIMENSION } from "@/lib/photos/imageFile";

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File([new Uint8Array(sizeBytes)], name, { type });
  return file;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validatePhotoFile", () => {
  it("rejects a file over the 10MB raw cap", () => {
    const file = makeFile("big.jpg", "image/jpeg", 10 * 1024 * 1024 + 1);
    expect(validatePhotoFile(file)).toBe("Foto is te groot (max 10MB).");
  });

  it("accepts JPEG/PNG/WebP", () => {
    expect(validatePhotoFile(makeFile("a.jpg", "image/jpeg", 1000))).toBeNull();
    expect(validatePhotoFile(makeFile("a.png", "image/png", 1000))).toBeNull();
    expect(validatePhotoFile(makeFile("a.webp", "image/webp", 1000))).toBeNull();
  });

  it("accepts HEIC/HEIF (by type or extension)", () => {
    expect(validatePhotoFile(makeFile("a.heic", "image/heic", 1000))).toBeNull();
    expect(validatePhotoFile(makeFile("IMG_1.HEIC", "", 1000))).toBeNull();
  });

  it("rejects an unsupported type", () => {
    expect(validatePhotoFile(makeFile("a.gif", "image/gif", 1000))).toBe(
      "Ongeldig bestandstype. Gebruik JPEG, PNG, WebP of HEIC.",
    );
  });
});

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

class FailingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onerror?.());
  }
}

describe("loadImageDimensions", () => {
  it("resolves with the image's natural dimensions", async () => {
    class SizedImage extends FakeImage {
      naturalWidth = 1200;
      naturalHeight = 800;
    }
    vi.stubGlobal("Image", SizedImage);

    await expect(loadImageDimensions("blob:fake")).resolves.toEqual({ width: 1200, height: 800 });
  });

  it("rejects when the image fails to load", async () => {
    vi.stubGlobal("Image", FailingImage);

    await expect(loadImageDimensions("blob:fake")).rejects.toThrow("Afbeelding kon niet worden gelezen.");
  });
});

describe("isLargeEnough", () => {
  it("accepts dimensions at or above the minimum on both axes", () => {
    expect(isLargeEnough({ width: MIN_DIMENSION, height: MIN_DIMENSION })).toBe(true);
    expect(isLargeEnough({ width: 1200, height: 800 })).toBe(true);
  });

  it("rejects when either axis is below the minimum", () => {
    expect(isLargeEnough({ width: MIN_DIMENSION - 1, height: 1000 })).toBe(false);
    expect(isLargeEnough({ width: 1000, height: MIN_DIMENSION - 1 })).toBe(false);
  });
});
