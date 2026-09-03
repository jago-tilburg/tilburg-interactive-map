import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const fetchEventPhotoDataUrl = vi.fn();
vi.mock("@/lib/maps/markerIcons", async () => {
  const actual = await vi.importActual<typeof import("@/lib/maps/markerIcons")>("@/lib/maps/markerIcons");
  return {
    ...actual,
    fetchEventPhotoDataUrl: (...a: unknown[]) => fetchEventPhotoDataUrl(...a),
  };
});

import { EventMarkerPreview } from "@/components/map/EventMarkerPreview";
import { DEFAULT_CARD_BORDER } from "@/lib/maps/markerIcons";

function decodeSvg(dataUrl: string): string {
  return decodeURIComponent(dataUrl.replace("data:image/svg+xml;charset=UTF-8,", ""));
}

describe("EventMarkerPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the caption and a marker image reflecting the category emoji when there's no photo", () => {
    render(<EventMarkerPreview category="eten" />);
    expect(screen.getByText("Zo verschijnt je evenement op de kaart")).toBeInTheDocument();
    const img = screen.getByAltText("");
    expect(decodeSvg((img as HTMLImageElement).src)).toContain("🍔");
  });

  it("uses the default card border colors when no umbrellaColor is given", () => {
    render(<EventMarkerPreview category="eten" />);
    const img = screen.getByAltText("");
    expect(decodeSvg((img as HTMLImageElement).src)).toContain(DEFAULT_CARD_BORDER[0]);
  });

  it("uses the umbrella's own color to derive the border gradient when given", () => {
    render(<EventMarkerPreview category="eten" umbrellaColor="#b45309" />);
    const img = screen.getByAltText("");
    expect(decodeSvg((img as HTMLImageElement).src)).toContain("#b45309");
  });

  it("resolves a pending photo Blob and embeds it as a data URL in the marker", async () => {
    const blob = new Blob(["fake-image-bytes"], { type: "image/webp" });
    render(<EventMarkerPreview category="eten" photoBlob={blob} />);

    await waitFor(() => {
      const img = screen.getByAltText("");
      expect(decodeSvg((img as HTMLImageElement).src)).toContain("<image href=\"data:");
    });
  });

  it("resolves an existing photoUrl via fetchEventPhotoDataUrl, matching the real map marker's behavior", async () => {
    fetchEventPhotoDataUrl.mockResolvedValue("data:image/webp;base64,ZmFrZQ==");
    render(<EventMarkerPreview category="eten" photoUrl="https://storage.example/businessEvents/1/photo.webp" />);

    expect(fetchEventPhotoDataUrl).toHaveBeenCalledWith("https://storage.example/businessEvents/1/photo.webp");
    await waitFor(() => {
      const img = screen.getByAltText("");
      expect(decodeSvg((img as HTMLImageElement).src)).toContain("data:image/webp;base64,ZmFrZQ==");
    });
  });

  it("prioritizes a pending photoBlob over an existing photoUrl", async () => {
    const blob = new Blob(["fake-image-bytes"], { type: "image/webp" });
    render(
      <EventMarkerPreview category="eten" photoBlob={blob} photoUrl="https://storage.example/businessEvents/1/photo.webp" />,
    );

    await waitFor(() => expect(fetchEventPhotoDataUrl).not.toHaveBeenCalled());
  });

  it("reflects happeningNow through to the marker (a glow filter is present in the SVG)", () => {
    render(<EventMarkerPreview category="eten" happeningNow />);
    const img = screen.getByAltText("");
    expect(decodeSvg((img as HTMLImageElement).src)).toContain("feGaussianBlur");
  });
});
