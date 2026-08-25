import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const createReport = vi.fn();
vi.mock("@/lib/firebase/reports", () => ({
  createReport: (...a: unknown[]) => createReport(...a),
}));

vi.mock("@/lib/shops/anonUserId", () => ({
  getAnonUserId: vi.fn(() => "anon-1"),
}));

import { ReportModal } from "@/components/common/ReportModal";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ currentVisitor: null });
  createReport.mockResolvedValue(undefined);
});

describe("ReportModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ReportModal open={false} onClose={vi.fn()} contentType="shop" contentId="9001" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("submits a report with the default reason and no details, using the anon id", async () => {
    const user = userEvent.setup();
    render(<ReportModal open onClose={vi.fn()} contentType="shop" contentId="9001" />);

    await user.click(screen.getByText("Melding versturen"));

    expect(createReport).toHaveBeenCalledWith("anon-1", {
      contentType: "shop",
      contentId: "9001",
      reason: "spam",
      details: undefined,
    });
    expect(await screen.findByText(/Bedankt voor je melding/)).toBeInTheDocument();
  });

  it("uses the signed-in visitor's uid instead of the anon id when available", async () => {
    mockUseAuth.mockReturnValue({ currentVisitor: { uid: "visitor-1" } });
    const user = userEvent.setup();
    render(<ReportModal open onClose={vi.fn()} contentType="businessEvent" contentId="evt1" />);

    await user.click(screen.getByText("Melding versturen"));

    expect(createReport).toHaveBeenCalledWith(
      "visitor-1",
      expect.objectContaining({ contentType: "businessEvent", contentId: "evt1" }),
    );
  });

  it("submits a chosen reason and trimmed details", async () => {
    const user = userEvent.setup();
    render(<ReportModal open onClose={vi.fn()} contentType="shop" contentId="9001" />);

    await user.selectOptions(screen.getByLabelText("Reden"), "offensive");
    await user.type(screen.getByLabelText("Toelichting (optioneel)"), "  Aanstootgevende tekst  ");
    await user.click(screen.getByText("Melding versturen"));

    expect(createReport).toHaveBeenCalledWith("anon-1", {
      contentType: "shop",
      contentId: "9001",
      reason: "offensive",
      details: "Aanstootgevende tekst",
    });
  });

  it("shows an error when submitting fails", async () => {
    createReport.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<ReportModal open onClose={vi.fn()} contentType="shop" contentId="9001" />);

    await user.click(screen.getByText("Melding versturen"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic error when submitting fails with a non-Error", async () => {
    createReport.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<ReportModal open onClose={vi.fn()} contentType="shop" contentId="9001" />);

    await user.click(screen.getByText("Melding versturen"));
    expect(await screen.findByText("Melden mislukt.")).toBeInTheDocument();
  });

  it("resets to the request step and calls onClose when cancelled", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ReportModal open onClose={onClose} contentType="shop" contentId="9001" />);

    await user.type(screen.getByLabelText("Toelichting (optioneel)"), "iets");
    await user.click(screen.getByText("Annuleren"));
    expect(onClose).toHaveBeenCalled();
    expect(createReport).not.toHaveBeenCalled();
  });

  it("closes from the sent confirmation step", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ReportModal open onClose={onClose} contentType="shop" contentId="9001" />);

    await user.click(screen.getByText("Melding versturen"));
    await screen.findByText(/Bedankt voor je melding/);
    await user.click(screen.getByText("Sluiten"));
    expect(onClose).toHaveBeenCalled();
  });
});
