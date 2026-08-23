import { describe, it, expect } from "vitest";
import { buildDropIconDataUrl, buildShopIconDataUrl } from "@/lib/maps/markerIcons";

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
