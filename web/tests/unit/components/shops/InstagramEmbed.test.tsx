import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const useIsMobile = vi.fn();
vi.mock("@/hooks/useIsMobile", () => ({
  useIsMobile: () => useIsMobile(),
}));

const loadInstagramEmbed = vi.fn();
vi.mock("@/lib/shops/loadInstagramEmbed", () => ({
  loadInstagramEmbed: () => loadInstagramEmbed(),
}));

import { InstagramEmbed } from "@/components/shops/InstagramEmbed";

beforeEach(() => {
  vi.clearAllMocks();
  useIsMobile.mockReturnValue(false);
  loadInstagramEmbed.mockResolvedValue(undefined);
  delete (window as { instgrm?: unknown }).instgrm;
});

describe("InstagramEmbed", () => {
  it("shows a placeholder when there is no valid Instagram url", () => {
    render(<InstagramEmbed instagramUrl={undefined} />);
    expect(screen.getByText("📷 Geen Instagram post beschikbaar")).toBeInTheDocument();
  });

  it("shows a placeholder for a non-Instagram url", () => {
    render(<InstagramEmbed instagramUrl="https://example.com/x" />);
    expect(screen.getByText("📷 Geen Instagram post beschikbaar")).toBeInTheDocument();
  });

  it("renders a lite link-out card on mobile instead of loading the embed script", () => {
    useIsMobile.mockReturnValue(true);
    render(<InstagramEmbed instagramUrl="https://www.instagram.com/p/ABC123/" />);

    const link = screen.getByText("📸 Bekijk op Instagram");
    expect(link).toHaveAttribute("href", "https://www.instagram.com/p/ABC123/");
    expect(loadInstagramEmbed).not.toHaveBeenCalled();
  });

  it("renders the live embed blockquote and processes it on desktop", async () => {
    const process = vi.fn();
    loadInstagramEmbed.mockImplementation(() => {
      window.instgrm = { Embeds: { process } };
      return Promise.resolve();
    });
    const { container } = render(<InstagramEmbed instagramUrl="https://www.instagram.com/p/ABC123/" />);

    const blockquote = container.querySelector("blockquote.instagram-media");
    expect(blockquote).toHaveAttribute("data-instgrm-permalink", "https://www.instagram.com/p/ABC123/");
    await waitFor(() => expect(process).toHaveBeenCalled());
  });

  it("does not crash when the embed script fails to load", async () => {
    loadInstagramEmbed.mockRejectedValue(new Error("network down"));
    const { container } = render(<InstagramEmbed instagramUrl="https://www.instagram.com/p/ABC123/" />);
    expect(container.querySelector("blockquote.instagram-media")).toBeInTheDocument();
  });

  it("does not process a stale load after unmounting", async () => {
    let resolveLoad: () => void = () => {};
    loadInstagramEmbed.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const { unmount } = render(<InstagramEmbed instagramUrl="https://www.instagram.com/p/ABC123/" />);
    unmount();
    window.instgrm = { Embeds: { process: vi.fn() } };
    resolveLoad();
    await Promise.resolve();

    expect(window.instgrm.Embeds.process).not.toHaveBeenCalled();
  });
});
