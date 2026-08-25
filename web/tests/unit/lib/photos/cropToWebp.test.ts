import { describe, it, expect, vi, afterEach } from "vitest";
import { cropToWebp } from "@/lib/photos/cropToWebp";

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("cropToWebp", () => {
  it("draws the cropped region scaled to maxDimension and encodes to WebP at the given quality", async () => {
    vi.stubGlobal("Image", FakeImage);
    const drawImage = vi.fn();
    const toBlob = vi.fn((cb: (blob: Blob | null) => void, type: string, quality: number) => {
      cb(new Blob(["webp-bytes"], { type }));
      expect(type).toBe("image/webp");
      expect(quality).toBe(0.8);
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(toBlob as never);
    const widthSpy = vi.spyOn(HTMLCanvasElement.prototype, "width", "set");
    const heightSpy = vi.spyOn(HTMLCanvasElement.prototype, "height", "set");

    const crop = { x: 10, y: 20, width: 2000, height: 1000 };
    const result = await cropToWebp("blob:source", crop, 1600, 0.8);

    // Long edge (2000) scales down to 1600 -> scale 0.8 -> short edge 1000*0.8=800.
    expect(widthSpy).toHaveBeenCalledWith(1600);
    expect(heightSpy).toHaveBeenCalledWith(800);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 10, 20, 2000, 1000, 0, 0, 1600, 800);
    expect(result).toBeInstanceOf(Blob);
  });

  it("never upscales a crop smaller than maxDimension", async () => {
    vi.stubGlobal("Image", FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(((cb: (blob: Blob | null) => void) =>
      cb(new Blob(["x"]))) as never);
    const widthSpy = vi.spyOn(HTMLCanvasElement.prototype, "width", "set");
    const heightSpy = vi.spyOn(HTMLCanvasElement.prototype, "height", "set");

    await cropToWebp("blob:source", { x: 0, y: 0, width: 400, height: 300 }, 1600, 0.8);

    expect(widthSpy).toHaveBeenCalledWith(400);
    expect(heightSpy).toHaveBeenCalledWith(300);
  });

  it("rejects when the source image fails to load", async () => {
    vi.stubGlobal("Image", FailingImage);

    await expect(cropToWebp("blob:source", { x: 0, y: 0, width: 100, height: 100 }, 1600, 0.8)).rejects.toThrow(
      "Afbeelding kon niet worden gelezen.",
    );
  });

  it("rejects when canvas 2D context isn't available", async () => {
    vi.stubGlobal("Image", FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    await expect(cropToWebp("blob:source", { x: 0, y: 0, width: 100, height: 100 }, 1600, 0.8)).rejects.toThrow(
      "Canvas wordt niet ondersteund in deze browser.",
    );
  });

  it("rejects when toBlob yields no blob (encode failure)", async () => {
    vi.stubGlobal("Image", FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(((cb: (blob: Blob | null) => void) =>
      cb(null)) as never);

    await expect(cropToWebp("blob:source", { x: 0, y: 0, width: 100, height: 100 }, 1600, 0.8)).rejects.toThrow(
      "Foto comprimeren is mislukt.",
    );
  });
});
