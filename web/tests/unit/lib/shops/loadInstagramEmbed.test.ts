import { describe, it, expect, beforeEach } from "vitest";
import { loadInstagramEmbed, _resetInstagramEmbedLoaderForTests } from "@/lib/shops/loadInstagramEmbed";

beforeEach(() => {
  _resetInstagramEmbedLoaderForTests();
  delete (window as { instgrm?: unknown }).instgrm;
  document.head.querySelectorAll("script").forEach((s) => s.remove());
});

describe("loadInstagramEmbed", () => {
  it("resolves immediately when instgrm is already present", async () => {
    window.instgrm = { Embeds: { process: () => {} } };
    await expect(loadInstagramEmbed()).resolves.toBeUndefined();
    expect(document.head.querySelectorAll("script")).toHaveLength(0);
  });

  it("injects exactly one script tag and resolves when it loads", async () => {
    const promise = loadInstagramEmbed();
    const script = document.head.querySelector("script");
    expect(script).not.toBeNull();
    expect(script!.src).toBe("https://www.instagram.com/embed.js");

    script!.onload?.(new Event("load"));
    await expect(promise).resolves.toBeUndefined();
  });

  it("reuses the same in-flight promise across concurrent calls", () => {
    const first = loadInstagramEmbed();
    const second = loadInstagramEmbed();
    expect(second).toBe(first);
    expect(document.head.querySelectorAll("script")).toHaveLength(1);
  });

  it("rejects and clears the cache when the script fails to load", async () => {
    const promise = loadInstagramEmbed();
    const script = document.head.querySelector("script")!;
    script.onerror?.(new Event("error"));

    await expect(promise).rejects.toThrow("Failed to load the Instagram embed script");

    document.head.querySelectorAll("script").forEach((s) => s.remove());
    const retry = loadInstagramEmbed();
    expect(document.head.querySelectorAll("script")).toHaveLength(1);
    document.head.querySelector("script")!.onload?.(new Event("load"));
    await expect(retry).resolves.toBeUndefined();
  });
});
