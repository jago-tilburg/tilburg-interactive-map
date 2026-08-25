import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UmbrellaEventDetailModal } from "@/components/events/UmbrellaEventDetailModal";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

const showToast = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast }),
}));

const shareCurrentUrl = vi.fn();
vi.mock("@/lib/shareUrl", () => ({
  shareCurrentUrl: (...a: unknown[]) => shareCurrentUrl(...a),
}));

const umbrella: UmbrellaEvent = {
  id: "u1",
  title: "Kermis",
  description: "Jaarlijkse kermis",
  color: "#b45309",
  startDate: "2026-09-01",
  endDate: "2026-09-10",
  createdAt: null as never,
};

function makeEvent(overrides: Partial<BusinessEvent> = {}): BusinessEvent {
  return {
    id: "evt1",
    title: "Test Event",
    category: "eten",
    description: "desc",
    startDate: "2026-09-02",
    endDate: "2026-09-02",
    startTime: "10:00",
    endTime: "18:00",
    address: "Heuvelplein 1",
    lat: 51.5,
    lng: 5.09,
    ownerId: "owner-uid",
    status: "approved",
    paid: false,
    createdAt: null as never,
    umbrellaEventId: "u1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  shareCurrentUrl.mockResolvedValue(true);
});

describe("UmbrellaEventDetailModal", () => {
  it("renders nothing when there is no umbrella", () => {
    const { container } = render(
      <UmbrellaEventDetailModal open onClose={vi.fn()} umbrella={null} approvedBusinessEvents={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the empty state when no approved events belong to this umbrella", () => {
    render(
      <UmbrellaEventDetailModal open onClose={vi.fn()} umbrella={umbrella} approvedBusinessEvents={[]} />,
    );
    expect(screen.getByText(/Nog geen goedgekeurde evenementen/)).toBeInTheDocument();
  });

  it("lists only approved events belonging to this umbrella and opens one on click", async () => {
    const onOpenEvent = vi.fn();
    const belonging = makeEvent();
    const notBelonging = makeEvent({ id: "evt2", title: "Other Umbrella Event", umbrellaEventId: "u2" });
    const user = userEvent.setup();

    render(
      <UmbrellaEventDetailModal
        open
        onClose={vi.fn()}
        umbrella={umbrella}
        approvedBusinessEvents={[belonging, notBelonging]}
        onOpenEvent={onOpenEvent}
      />,
    );

    expect(screen.getByText(/Test Event/)).toBeInTheDocument();
    expect(screen.queryByText(/Other Umbrella Event/)).not.toBeInTheDocument();

    await user.click(screen.getByText(/Test Event/));
    expect(onOpenEvent).toHaveBeenCalledWith("evt1");
  });

  describe("share button", () => {
    afterEach(() => {
      // @ts-expect-error -- jsdom doesn't define navigator.share by default; this only exists when a test adds it
      delete navigator.share;
    });

    it("shares via the clipboard fallback and shows a toast (no Web Share API in this test environment)", async () => {
      const user = userEvent.setup();
      render(
        <UmbrellaEventDetailModal open onClose={vi.fn()} umbrella={umbrella} approvedBusinessEvents={[]} />,
      );

      await user.click(screen.getByText("🔗 Delen"));

      expect(shareCurrentUrl).toHaveBeenCalledWith("Kermis");
      expect(showToast).toHaveBeenCalledWith("Link gekopieerd.", "success");
    });

    it("does not show a toast when the native Web Share API is used", async () => {
      Object.defineProperty(navigator, "share", { value: vi.fn(), configurable: true });
      const user = userEvent.setup();
      render(
        <UmbrellaEventDetailModal open onClose={vi.fn()} umbrella={umbrella} approvedBusinessEvents={[]} />,
      );

      await user.click(screen.getByText("🔗 Delen"));

      expect(showToast).not.toHaveBeenCalled();
    });
  });
});
