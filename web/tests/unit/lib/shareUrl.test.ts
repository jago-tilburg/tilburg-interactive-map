import { describe, it, expect, vi, afterEach } from "vitest";
import { shareCurrentUrl } from "@/lib/shareUrl";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shareCurrentUrl", () => {
  it("uses the Web Share API when available, and resolves true on success", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText: vi.fn() } });

    const result = await shareCurrentUrl("Test Shop");

    expect(share).toHaveBeenCalledWith({ url: window.location.href, title: "Test Shop" });
    expect(result).toBe(true);
  });

  it("resolves false when the user cancels the native share sheet", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    vi.stubGlobal("navigator", { share, clipboard: { writeText: vi.fn() } });

    const result = await shareCurrentUrl("Test Shop");

    expect(result).toBe(false);
  });

  it("falls back to the clipboard when the Web Share API isn't available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await shareCurrentUrl("Test Shop");

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(result).toBe(true);
  });

  it("resolves false when the clipboard write itself fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await shareCurrentUrl("Test Shop");

    expect(result).toBe(false);
  });
});
