import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildDropIconDataUrl,
  buildShopIconDataUrl,
  computeEventCardWidth,
  buildEventCardIconDataUrl,
  fetchEventPhotoDataUrl,
  shadeColor,
} from "@/lib/maps/markerIcons";

describe("buildDropIconDataUrl", () => {
  it("embeds the rating text and color when showText is true", () => {
    const url = buildDropIconDataUrl(8.234, "#16a34a", true);
    const svg = decodeURIComponent(url.replace("data:image/svg+xml;charset=UTF-8,", ""));
    expect(svg).toContain("8.2");
    expect(svg).toContain("#16a34a");
    expect(svg).toContain("<text");
  });

  it("omits the text element when showText is false", () => {
    const url = buildDropIconDataUrl(8, "#16a34a", false);
    const svg = decodeURIComponent(url.replace("data:image/svg+xml;charset=UTF-8,", ""));
    expect(svg).not.toContain("<text");
  });

  it("treats a falsy rating as 0 when text is shown", () => {
    const url = buildDropIconDataUrl(0, "#dc2626", true);
    const svg = decodeURIComponent(url.replace("data:image/svg+xml;charset=UTF-8,", ""));
    expect(svg).toContain("0.0");
  });
});

describe("buildShopIconDataUrl", () => {
  it("colors the icon by the rating threshold", () => {
    const highUrl = decodeURIComponent(buildShopIconDataUrl(8));
    const lowUrl = decodeURIComponent(buildShopIconDataUrl(3));
    expect(highUrl).toContain("#16a34a");
    expect(lowUrl).toContain("#dc2626");
  });
});

describe("computeEventCardWidth", () => {
  it("returns the base width at the base zoom", () => {
    expect(computeEventCardWidth(14)).toBe(49);
  });

  it("grows with zoom", () => {
    expect(computeEventCardWidth(16)).toBeGreaterThan(computeEventCardWidth(14));
  });

  it("shrinks with zoom", () => {
    expect(computeEventCardWidth(10)).toBeLessThan(computeEventCardWidth(14));
  });

  it("clamps to the minimum width", () => {
    expect(computeEventCardWidth(0)).toBe(28);
  });

  it("clamps to the maximum width", () => {
    expect(computeEventCardWidth(25)).toBe(200);
  });
});

describe("buildEventCardIconDataUrl", () => {
  it("embeds the photo as a clipped <image> when a photoUrl is given", () => {
    const { url, height } = buildEventCardIconDataUrl({
      width: 49,
      photoUrl: "https://example.com/photo.jpg",
      categoryEmoji: "🍔",
      borderColors: ["#22c55e", "#ff6b35"],
    });
    const svg = decodeURIComponent(url);
    expect(svg).toContain("<image");
    expect(svg).toContain("https://example.com/photo.jpg");
    expect(svg).toContain("#22c55e");
    expect(svg).toContain("#ff6b35");
    expect(height).toBeGreaterThan(0);
  });

  it("falls back to a category-emoji placeholder when there is no photoUrl", () => {
    const { url } = buildEventCardIconDataUrl({
      width: 49,
      categoryEmoji: "🎵",
      borderColors: ["#22c55e", "#ff6b35"],
    });
    const svg = decodeURIComponent(url);
    expect(svg).not.toContain("<image");
    expect(svg).toContain("🎵");
  });

  it("animates the border gradient's rotation", () => {
    const { url } = buildEventCardIconDataUrl({
      width: 49,
      categoryEmoji: "🍔",
      borderColors: ["#22c55e", "#ff6b35"],
    });
    const svg = decodeURIComponent(url);
    expect(svg).toContain('<animateTransform attributeName="gradientTransform" type="rotate"');
  });

  it("adds no glow when happeningNow is false or omitted", () => {
    const { url } = buildEventCardIconDataUrl({
      width: 49,
      categoryEmoji: "🍔",
      borderColors: ["#22c55e", "#ff6b35"],
      happeningNow: false,
    });
    const svg = decodeURIComponent(url);
    expect(svg).not.toContain("cardGlow");
    expect(svg).not.toContain("glowBlur");
  });

  it("adds a pulsing glow when happeningNow is true", () => {
    const { url } = buildEventCardIconDataUrl({
      width: 49,
      categoryEmoji: "🍔",
      borderColors: ["#22c55e", "#ff6b35"],
      happeningNow: true,
    });
    const svg = decodeURIComponent(url);
    expect(svg).toContain("cardGlow");
    expect(svg).toContain("glowBlur");
    expect(svg).toContain("feGaussianBlur");
    expect(svg).toContain('<animate attributeName="opacity"');
  });

  it("computes height from width using the prototype's 1.5 aspect ratio", () => {
    const { height } = buildEventCardIconDataUrl({
      width: 100,
      categoryEmoji: "🍔",
      borderColors: ["#22c55e", "#ff6b35"],
    });
    expect(height).toBe(150);
  });
});

describe("fetchEventPhotoDataUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a data: URL unchanged without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchEventPhotoDataUrl("data:image/png;base64,abc123");

    expect(result).toBe("data:image/png;base64,abc123");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the photo with cors mode and converts the blob to a base64 data URL", async () => {
    const blob = new Blob(["fake-image-bytes"], { type: "image/png" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchEventPhotoDataUrl("https://example.com/photo-fetch-a.jpg");

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/photo-fetch-a.jpg", { mode: "cors" });
    expect(result).toMatch(/^data:/);
  });

  it("caches by URL — a second call for the same URL does not re-fetch", async () => {
    const blob = new Blob(["fake-image-bytes"], { type: "image/png" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    vi.stubGlobal("fetch", fetchMock);

    await fetchEventPhotoDataUrl("https://example.com/photo-fetch-b.jpg");
    await fetchEventPhotoDataUrl("https://example.com/photo-fetch-b.jpg");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null and does not cache on a non-ok response, allowing a later retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const first = await fetchEventPhotoDataUrl("https://example.com/photo-fetch-c.jpg");
    expect(first).toBeNull();

    const blob = new Blob(["fake-image-bytes"], { type: "image/png" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) }));
    const second = await fetchEventPhotoDataUrl("https://example.com/photo-fetch-c.jpg");
    expect(second).toMatch(/^data:/);
  });

  it("returns null when fetch itself rejects (e.g. a CORS or network failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const result = await fetchEventPhotoDataUrl("https://example.com/photo-fetch-d.jpg");

    expect(result).toBeNull();
  });

  it("returns null when the blob-to-data-URL conversion itself fails", async () => {
    const blob = new Blob(["fake-image-bytes"], { type: "image/png" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) }));

    class FailingFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      error = new Error("read failed");
      readAsDataURL() {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal("FileReader", FailingFileReader);

    const result = await fetchEventPhotoDataUrl("https://example.com/photo-fetch-e.jpg");

    expect(result).toBeNull();
  });
});

describe("shadeColor", () => {
  it("lightens a color with a positive percent", () => {
    expect(shadeColor("#000000", 50)).toBe("#7f7f7f");
  });

  it("darkens a color with a negative percent", () => {
    expect(shadeColor("#ffffff", -50)).toBe("#808080");
  });

  it("clamps at white", () => {
    expect(shadeColor("#ffffff", 50)).toBe("#ffffff");
  });

  it("clamps at black", () => {
    expect(shadeColor("#000000", -50)).toBe("#000000");
  });
});
