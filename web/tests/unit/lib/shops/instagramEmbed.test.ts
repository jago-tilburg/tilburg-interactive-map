import { describe, it, expect } from "vitest";
import { getInstagramEmbedUrl } from "@/lib/shops/instagramEmbed";

describe("getInstagramEmbedUrl", () => {
  it("returns null when the url is undefined", () => {
    expect(getInstagramEmbedUrl(undefined)).toBeNull();
  });

  it("returns null for a non-Instagram url", () => {
    expect(getInstagramEmbedUrl("https://example.com/foo")).toBeNull();
  });

  it("normalizes a /p/ post url", () => {
    expect(getInstagramEmbedUrl("https://www.instagram.com/p/ABC123/?utm_source=x")).toBe(
      "https://www.instagram.com/p/ABC123/",
    );
  });

  it("normalizes a /reel/ url", () => {
    expect(getInstagramEmbedUrl("https://instagram.com/reel/XYZ789")).toBe(
      "https://www.instagram.com/reel/XYZ789/",
    );
  });

  it("normalizes a /tv/ url", () => {
    expect(getInstagramEmbedUrl("http://www.instagram.com/tv/QWE456/")).toBe(
      "https://www.instagram.com/tv/QWE456/",
    );
  });
});
