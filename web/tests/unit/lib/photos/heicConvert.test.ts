import { describe, it, expect, vi, beforeEach } from "vitest";

const heic2any = vi.fn();
vi.mock("heic2any", () => ({ default: (...a: unknown[]) => heic2any(...a) }));

import { isHeic, convertHeicToJpeg } from "@/lib/photos/heicConvert";

function makeFile(name: string, type: string): File {
  return new File(["fake-image-bytes"], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isHeic", () => {
  it("recognizes image/heic and image/heif MIME types", () => {
    expect(isHeic(makeFile("photo.heic", "image/heic"))).toBe(true);
    expect(isHeic(makeFile("photo.heif", "image/heif"))).toBe(true);
    expect(isHeic(makeFile("photo.HEIC", "IMAGE/HEIC"))).toBe(true);
  });

  it("falls back to the .heic/.heif extension when the MIME type is empty (Safari)", () => {
    expect(isHeic(makeFile("IMG_1234.HEIC", ""))).toBe(true);
    expect(isHeic(makeFile("IMG_1234.heif", "application/octet-stream"))).toBe(true);
  });

  it("returns false for regular image types", () => {
    expect(isHeic(makeFile("photo.jpg", "image/jpeg"))).toBe(false);
    expect(isHeic(makeFile("photo.png", "image/png"))).toBe(false);
    expect(isHeic(makeFile("photo.webp", "image/webp"))).toBe(false);
  });
});

describe("convertHeicToJpeg", () => {
  it("converts via heic2any and returns the resulting Blob directly", async () => {
    const jpegBlob = new Blob(["jpeg-bytes"], { type: "image/jpeg" });
    heic2any.mockResolvedValue(jpegBlob);
    const file = makeFile("photo.heic", "image/heic");

    const result = await convertHeicToJpeg(file);

    expect(heic2any).toHaveBeenCalledWith({ blob: file, toType: "image/jpeg", quality: 0.9 });
    expect(result).toBe(jpegBlob);
  });

  it("takes the first Blob when heic2any resolves with an array (multi-image HEIC)", async () => {
    const first = new Blob(["frame-1"], { type: "image/jpeg" });
    const second = new Blob(["frame-2"], { type: "image/jpeg" });
    heic2any.mockResolvedValue([first, second]);

    const result = await convertHeicToJpeg(makeFile("photo.heic", "image/heic"));

    expect(result).toBe(first);
  });
});
