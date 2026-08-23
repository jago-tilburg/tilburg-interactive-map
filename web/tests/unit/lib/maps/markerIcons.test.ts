import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildDropIconDataUrl,
  buildShopIconDataUrl,
  computeMarkerSize,
  buildEventCardIconDataUrl,
  computeIconScaledSize,
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

describe("computeMarkerSize", () => {
  it("returns the base width/height at the base zoom", () => {
    // aspectRatio 1.5 * baseWidth 49 = 73.5, rounded to 74
    expect(computeMarkerSize(14)).toEqual({ w: 49, h: 74 });
  });

  it("grows with zoom", () => {
    expect(computeMarkerSize(16).w).toBeGreaterThan(computeMarkerSize(14).w);
  });

  it("shrinks with zoom", () => {
    expect(computeMarkerSize(10).w).toBeLessThan(computeMarkerSize(14).w);
  });

  it("clamps to the minimum width", () => {
    expect(computeMarkerSize(0)).toEqual({ w: 28, h: 42 });
  });

  it("clamps to the maximum width", () => {
    expect(computeMarkerSize(25)).toEqual({ w: 200, h: 300 });
  });
});

describe("buildEventCardIconDataUrl", () => {
  it("embeds the photo as a clipped <image> when a photoUrl is given", () => {
    const { url, cardW, cardH } = buildEventCardIconDataUrl({
      photoUrl: "https://example.com/photo.jpg",
      categoryEmoji: "🍔",
      borderColors: ["#22c55e", "#ff6b35"],
    });
    const svg = decodeURIComponent(url);
    expect(svg).toContain("<image");
    expect(svg).toContain("https://example.com/photo.jpg");
    expect(svg).toContain("#22c55e");
    expect(svg).toContain("#ff6b35");
    // cardW/cardH are the fixed internal coordinate-space size (60 wide,
    // bodyBottom 66 + default pointerHeight 18 + a 4-unit buffer) — not
    // derived from any per-call width, since the actual on-screen size is
    // applied afterwards via computeIconScaledSize.
    expect(cardW).toBe(60);
    expect(cardH).toBe(88);
  });

  it("falls back to a category-emoji placeholder when there is no photoUrl", () => {
    const { url } = buildEventCardIconDataUrl({
      categoryEmoji: "🎵",
      borderColors: ["#22c55e", "#ff6b35"],
    });
    const svg = decodeURIComponent(url);
    expect(svg).not.toContain("<image");
    expect(svg).toContain("🎵");
  });

  it("splits the border gradient into two clustered stops around the prototype's midpoint/spread (48 ± 6.5)", () => {
    const { url } = buildEventCardIconDataUrl({
      categoryEmoji: "🍔",
      borderColors: ["#22c55e", "#ff6b35"],
    });
    const svg = decodeURIComponent(url);
    expect(svg).toContain('offset="41.5%"');
    expect(svg).toContain('offset="54.5%"');
  });

  it("animates the border gradient's rotation at the prototype's 2.5s duration", () => {
    const { url } = buildEventCardIconDataUrl({
      categoryEmoji: "🍔",
      borderColors: ["#22c55e", "#ff6b35"],
    });
    const svg = decodeURIComponent(url);
    expect(svg).toContain('<animateTransform attributeName="transform" type="rotate"');
    expect(svg).toContain('dur="2.5s"');
  });

  it("adds no glow, and no extra canvas padding, when happeningNow is false or omitted", () => {
    const { url, contentW, contentH, cardW, cardH } = buildEventCardIconDataUrl({
      categoryEmoji: "🍔",
      borderColors: ["#22c55e", "#ff6b35"],
      happeningNow: false,
    });
    const svg = decodeURIComponent(url);
    expect(svg).not.toContain("feGaussianBlur");
    expect(svg).not.toContain('<animate attributeName="opacity"');
    expect(contentW).toBe(cardW);
    expect(contentH).toBe(cardH);
  });

  it("adds a pulsing glow, padded by glowPad (27) on every side, when happeningNow is true", () => {
    const { url, contentW, contentH, cardW, cardH } = buildEventCardIconDataUrl({
      categoryEmoji: "🍔",
      borderColors: ["#22c55e", "#ff6b35"],
      happeningNow: true,
    });
    const svg = decodeURIComponent(url);
    expect(svg).toContain("feGaussianBlur");
    expect(svg).toContain('stdDeviation="12"');
    expect(svg).toContain('<animate attributeName="opacity" values="0;1;0"');
    expect(contentW).toBe(cardW + 54);
    expect(contentH).toBe(cardH + 54);
  });
});

describe("computeIconScaledSize", () => {
  it("scales content/card size proportionally and anchors at the pointer tip when there is no glow padding", () => {
    const meta = { url: "", cardW: 60, cardH: 88, contentW: 60, contentH: 88 };
    const { scaledSize, anchor } = computeIconScaledSize(meta, 49, 74);
    expect(scaledSize).toEqual({ width: 49, height: 74 });
    expect(anchor).toEqual({ x: 24.5, y: 74 });
  });

  it("shifts the anchor up to account for glow padding above and below the card", () => {
    const meta = { url: "", cardW: 60, cardH: 88, contentW: 114, contentH: 142 };
    const { scaledSize, anchor } = computeIconScaledSize(meta, 60, 88);
    expect(scaledSize).toEqual({ width: 114, height: 142 });
    expect(anchor).toEqual({ x: 57, y: 115 });
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
