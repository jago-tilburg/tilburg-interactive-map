import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const showToast = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast }),
}));

const shareCurrentUrl = vi.fn();
vi.mock("@/lib/shareUrl", () => ({
  shareCurrentUrl: (...a: unknown[]) => shareCurrentUrl(...a),
}));

const trackEventView = vi.fn();
const incrementEventInterest = vi.fn();
const incrementEventClicks = vi.fn();
const incrementEventShares = vi.fn();
vi.mock("@/lib/firebase/businessEvents", () => ({
  trackEventView: (...a: unknown[]) => trackEventView(...a),
  incrementEventInterest: (...a: unknown[]) => incrementEventInterest(...a),
  incrementEventClicks: (...a: unknown[]) => incrementEventClicks(...a),
  incrementEventShares: (...a: unknown[]) => incrementEventShares(...a),
}));

const setEventSaved = vi.fn();
vi.mock("@/lib/firebase/firestore", () => ({
  setEventSaved: (...a: unknown[]) => setEventSaved(...a),
}));

const createReport = vi.fn();
vi.mock("@/lib/firebase/reports", () => ({
  createReport: (...a: unknown[]) => createReport(...a),
}));

vi.mock("@/lib/shops/anonUserId", () => ({
  getAnonUserId: vi.fn(() => "anon-1"),
}));

import { BusinessEventDetailModal } from "@/components/events/BusinessEventDetailModal";

function makeEvent(overrides: Partial<BusinessEvent> = {}): BusinessEvent {
  return {
    id: "evt1",
    title: "Test Event",
    category: "muziek",
    description: "A great show",
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    startTime: "10:00",
    endTime: "18:00",
    address: "Heuvelplein 1",
    lat: 51.5,
    lng: 5.09,
    ownerId: "owner-uid",
    status: "approved",
    paid: true,
    createdAt: null as never,
    umbrellaEventId: "u1",
    ...overrides,
  };
}

const umbrella: UmbrellaEvent = {
  id: "u1",
  title: "Kermis",
  description: "",
  color: "#b45309",
  startDate: "2026-01-01",
  endDate: "2099-01-01",
  createdAt: null as never,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ currentVisitor: null });
  trackEventView.mockResolvedValue(undefined);
  incrementEventInterest.mockResolvedValue(undefined);
  incrementEventClicks.mockResolvedValue(undefined);
  incrementEventShares.mockResolvedValue(undefined);
  shareCurrentUrl.mockResolvedValue(true);
  setEventSaved.mockResolvedValue(undefined);
  createReport.mockResolvedValue(undefined);
});

describe("BusinessEventDetailModal", () => {
  it("renders nothing when there is no event", () => {
    const { container } = render(
      <BusinessEventDetailModal open onClose={vi.fn()} event={null} umbrellaEvents={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows title, address, schedule, description, and a category placeholder when there's no photo", () => {
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);

    expect(screen.getByRole("dialog", { name: "🎵 Test Event" })).toBeInTheDocument();
    expect(screen.getByText(/Heuvelplein 1/)).toBeInTheDocument();
    expect(screen.getByText("A great show")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the photo when photoUrl is set", () => {
    render(
      <BusinessEventDetailModal
        open
        onClose={vi.fn()}
        event={makeEvent({ photoUrl: "https://example.com/photo.jpg" })}
        umbrellaEvents={[]}
      />,
    );
    expect(screen.getByRole("img", { name: "Test Event" })).toHaveAttribute(
      "src",
      "https://example.com/photo.jpg",
    );
  });

  it("renders the _detail derivative for an own-Storage photoUrl", () => {
    const photoUrl = "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/businessEvents%2Fevt1%2Fx.webp?alt=media";
    render(
      <BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent({ photoUrl })} umbrellaEvents={[]} />,
    );
    expect(screen.getByRole("img", { name: "Test Event" })).toHaveAttribute(
      "src",
      "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/businessEvents%2Fevt1%2Fx_detail.webp?alt=media",
    );
  });

  it("falls back to the original photoUrl when the _detail derivative fails to load", () => {
    const photoUrl = "https://firebasestorage.googleapis.com/v0/b/test-bucket/o/businessEvents%2Fevt1%2Fx.webp?alt=media";
    render(
      <BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent({ photoUrl })} umbrellaEvents={[]} />,
    );
    const img = screen.getByRole("img", { name: "Test Event" });

    fireEvent.error(img);

    expect(img).toHaveAttribute("src", photoUrl);
  });

  it("shows the umbrella badge and calls onOpenUmbrella when clicked", async () => {
    const onOpenUmbrella = vi.fn();
    const user = userEvent.setup();
    render(
      <BusinessEventDetailModal
        open
        onClose={vi.fn()}
        event={makeEvent()}
        umbrellaEvents={[umbrella]}
        onOpenUmbrella={onOpenUmbrella}
      />,
    );

    const badge = screen.getByText(/Onderdeel van Kermis/);
    await user.click(badge);
    expect(onOpenUmbrella).toHaveBeenCalledWith("u1");
  });

  it("does not show an umbrella badge when the referenced umbrella isn't in the list", () => {
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);
    expect(screen.queryByText(/Onderdeel van/)).not.toBeInTheDocument();
  });

  it("tracks a view when opened", () => {
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);
    expect(trackEventView).toHaveBeenCalledWith("evt1");
  });

  it("swallows a view-tracking failure without crashing", async () => {
    trackEventView.mockRejectedValue(new Error("network down"));
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not track a view when closed", () => {
    render(<BusinessEventDetailModal open={false} onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);
    expect(trackEventView).not.toHaveBeenCalled();
  });

  it("truncates a long description with a 'Meer lezen' toggle that expands and collapses it", async () => {
    const user = userEvent.setup();
    const longDescription = "x".repeat(250);
    render(
      <BusinessEventDetailModal
        open
        onClose={vi.fn()}
        event={makeEvent({ description: longDescription })}
        umbrellaEvents={[]}
      />,
    );

    expect(screen.getByText(/x{220}…/)).toBeInTheDocument();
    await user.click(screen.getByText("Meer lezen"));
    expect(screen.getByText(longDescription)).toBeInTheDocument();
    await user.click(screen.getByText("Minder tonen"));
    expect(screen.getByText(/x{220}…/)).toBeInTheDocument();
  });

  it("does not show a read-more toggle for a short description", () => {
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);
    expect(screen.queryByText("Meer lezen")).not.toBeInTheDocument();
  });

  it("shows tiered pricing, formatting a zero amount as Gratis", () => {
    render(
      <BusinessEventDetailModal
        open
        onClose={vi.fn()}
        event={makeEvent({ prices: [{ label: "Vroegboekticket", amount: 12.5 }, { label: "Kind", amount: 0 }] })}
        umbrellaEvents={[]}
      />,
    );
    expect(screen.getByText("€12.50")).toBeInTheDocument();
    expect(screen.getByText("Gratis")).toBeInTheDocument();
  });

  it("does not show a pricing block when there are no prices", () => {
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);
    expect(screen.queryByText("Gratis")).not.toBeInTheDocument();
  });

  it("increments and displays the interest counter on click", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent({ interest: 3 })} umbrellaEvents={[]} />,
    );
    expect(screen.getByText("👍 3")).toBeInTheDocument();
    await user.click(screen.getByText("👍 3"));
    expect(screen.getByText("👍 4")).toBeInTheDocument();
    expect(incrementEventInterest).toHaveBeenCalledWith("evt1");
  });

  it("rolls back the interest counter if the increment fails", async () => {
    incrementEventInterest.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(
      <BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent({ interest: 0 })} umbrellaEvents={[]} />,
    );
    await user.click(screen.getByText("👍 0"));
    expect(await screen.findByText("👍 0")).toBeInTheDocument();
  });

  it("shows a login hint instead of saving when logged out", async () => {
    const user = userEvent.setup();
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);
    await user.click(screen.getByText("🔖 Bewaar"));
    expect(screen.getByText("Log in om evenementen te bewaren.")).toBeInTheDocument();
    expect(setEventSaved).not.toHaveBeenCalled();
  });

  it("toggles saved on and off for a logged-in visitor", async () => {
    mockUseAuth.mockReturnValue({ currentVisitor: { uid: "visitor-1", savedEventIds: [] } });
    const user = userEvent.setup();
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);

    await user.click(screen.getByText("🔖 Bewaar"));
    expect(screen.getByText("🔖 Bewaard")).toBeInTheDocument();
    expect(setEventSaved).toHaveBeenCalledWith("visitor-1", "evt1", true);

    await user.click(screen.getByText("🔖 Bewaard"));
    expect(screen.getByText("🔖 Bewaar")).toBeInTheDocument();
    expect(setEventSaved).toHaveBeenCalledWith("visitor-1", "evt1", false);
  });

  it("starts as saved when the event is already in the visitor's savedEventIds", () => {
    mockUseAuth.mockReturnValue({ currentVisitor: { uid: "visitor-1", savedEventIds: ["evt1"] } });
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);
    expect(screen.getByText("🔖 Bewaard")).toBeInTheDocument();
  });

  it("rolls back the save toggle if the write fails", async () => {
    mockUseAuth.mockReturnValue({ currentVisitor: { uid: "visitor-1", savedEventIds: [] } });
    setEventSaved.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);

    await user.click(screen.getByText("🔖 Bewaar"));
    expect(await screen.findByText("🔖 Bewaar")).toBeInTheDocument();
  });

  it("does not show the website CTA when there is no websiteUrl", () => {
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);
    expect(screen.queryByText("🎟️ Ik wil hierheen!")).not.toBeInTheDocument();
  });

  // Regression test for a pen-test finding: websiteUrl is free-text on the
  // event record, writable by any business on their own event with no
  // scheme restriction at write time — a javascript: URI would execute in
  // a visitor's browser via window.open() if not guarded at the point of use.
  it("does not show the website CTA when websiteUrl is a javascript: URI", () => {
    render(
      <BusinessEventDetailModal
        open
        onClose={vi.fn()}
        event={makeEvent({ websiteUrl: "javascript:alert(document.cookie)" })}
        umbrellaEvents={[]}
      />,
    );
    expect(screen.queryByText("🎟️ Ik wil hierheen!")).not.toBeInTheDocument();
  });

  it("tracks a click and opens the website in a new tab", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(
      <BusinessEventDetailModal
        open
        onClose={vi.fn()}
        event={makeEvent({ websiteUrl: "https://example.com" })}
        umbrellaEvents={[]}
      />,
    );

    await user.click(screen.getByText("🎟️ Ik wil hierheen!"));
    expect(incrementEventClicks).toHaveBeenCalledWith("evt1");
    expect(openSpy).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
    openSpy.mockRestore();
  });

  it("still opens the website even if click-tracking fails", async () => {
    incrementEventClicks.mockRejectedValue(new Error("network down"));
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(
      <BusinessEventDetailModal
        open
        onClose={vi.fn()}
        event={makeEvent({ websiteUrl: "https://example.com" })}
        umbrellaEvents={[]}
      />,
    );

    await user.click(screen.getByText("🎟️ Ik wil hierheen!"));
    expect(openSpy).toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("re-syncs interest/saved/description state when a different event is shown", () => {
    mockUseAuth.mockReturnValue({ currentVisitor: { uid: "visitor-1", savedEventIds: ["evt2"] } });
    const { rerender } = render(
      <BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent({ id: "evt1", interest: 1 })} umbrellaEvents={[]} />,
    );
    expect(screen.getByText("👍 1")).toBeInTheDocument();
    expect(screen.getByText("🔖 Bewaar")).toBeInTheDocument();

    rerender(
      <BusinessEventDetailModal
        open
        onClose={vi.fn()}
        event={makeEvent({ id: "evt2", interest: 9 })}
        umbrellaEvents={[]}
      />,
    );
    expect(screen.getByText("👍 9")).toBeInTheDocument();
    expect(screen.getByText("🔖 Bewaard")).toBeInTheDocument();
  });

  it("opens the report modal and files a report against the event", async () => {
    const user = userEvent.setup();
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);

    await user.click(screen.getByText("🚩 Melden"));
    await user.click(screen.getByText("Melding versturen"));

    expect(createReport).toHaveBeenCalledWith(
      "anon-1",
      expect.objectContaining({ contentType: "businessEvent", contentId: "evt1" }),
    );
  });

  describe("share button", () => {
    afterEach(() => {
      // @ts-expect-error -- jsdom doesn't define navigator.share by default; this only exists when a test adds it
      delete navigator.share;
    });

    it("shares via the clipboard fallback, shows a toast, and bumps the share counter", async () => {
      const user = userEvent.setup();
      render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);

      await user.click(screen.getByText("🔗 Delen"));

      expect(shareCurrentUrl).toHaveBeenCalledWith("Test Event");
      expect(showToast).toHaveBeenCalledWith("Link gekopieerd.", "success");
      expect(incrementEventShares).toHaveBeenCalledWith("evt1");
    });

    it("does not show a toast when the native Web Share API is used, but still bumps the share counter", async () => {
      Object.defineProperty(navigator, "share", { value: vi.fn(), configurable: true });
      const user = userEvent.setup();
      render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);

      await user.click(screen.getByText("🔗 Delen"));

      expect(showToast).not.toHaveBeenCalled();
      expect(incrementEventShares).toHaveBeenCalledWith("evt1");
    });

    it("does not bump the share counter when the share/copy is cancelled or fails", async () => {
      shareCurrentUrl.mockResolvedValue(false);
      const user = userEvent.setup();
      render(<BusinessEventDetailModal open onClose={vi.fn()} event={makeEvent()} umbrellaEvents={[]} />);

      await user.click(screen.getByText("🔗 Delen"));

      expect(incrementEventShares).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();
    });
  });
});
