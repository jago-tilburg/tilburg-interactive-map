import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const submitRequest = vi.fn();
vi.mock("@/lib/firebase/requests", () => ({
  submitRequest: (...a: unknown[]) => submitRequest(...a),
}));

const trackEvent = vi.fn();
vi.mock("@/lib/analytics/trackEvent", () => ({
  trackEvent: (...a: unknown[]) => trackEvent(...a),
}));

vi.mock("@/lib/shops/anonUserId", () => ({
  getAnonUserId: vi.fn(() => "anon-1"),
}));

import { RequestModal } from "@/components/requests/RequestModal";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ currentVisitor: null });
  submitRequest.mockResolvedValue(undefined);
});

describe("RequestModal", () => {
  it("does nothing when the shop name is empty", async () => {
    const user = userEvent.setup();
    render(<RequestModal open onClose={vi.fn()} onSubmitted={vi.fn()} />);

    await user.click(screen.getByText("Versturen"));
    expect(submitRequest).not.toHaveBeenCalled();
  });

  it("submits with the anonymous user id, tracks the event, and calls onSubmitted", async () => {
    const onSubmitted = vi.fn();
    const user = userEvent.setup();
    render(<RequestModal open onClose={vi.fn()} onSubmitted={onSubmitted} />);

    await user.type(screen.getByLabelText("Naam van de zaak"), "Nieuwe Broodjeszaak");
    await user.click(screen.getByText("Versturen"));

    expect(submitRequest).toHaveBeenCalledWith("Nieuwe Broodjeszaak", "anon-1");
    expect(trackEvent).toHaveBeenCalledWith("submit_review_request", { shop_name: "Nieuwe Broodjeszaak" });
    expect(onSubmitted).toHaveBeenCalled();
  });

  it("uses the signed-in visitor's uid instead of the anonymous id", async () => {
    mockUseAuth.mockReturnValue({ currentVisitor: { uid: "visitor-1" } });
    const user = userEvent.setup();
    render(<RequestModal open onClose={vi.fn()} onSubmitted={vi.fn()} />);

    await user.type(screen.getByLabelText("Naam van de zaak"), "Nieuwe Broodjeszaak");
    await user.click(screen.getByText("Versturen"));

    expect(submitRequest).toHaveBeenCalledWith("Nieuwe Broodjeszaak", "visitor-1");
  });

  it("shows an error message when submitting fails", async () => {
    submitRequest.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<RequestModal open onClose={vi.fn()} onSubmitted={vi.fn()} />);

    await user.type(screen.getByLabelText("Naam van de zaak"), "Nieuwe Broodjeszaak");
    await user.click(screen.getByText("Versturen"));

    expect(await screen.findByText("Er ging iets mis: network down")).toBeInTheDocument();
  });

  it("shows a generic error message when a non-Error is thrown", async () => {
    submitRequest.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<RequestModal open onClose={vi.fn()} onSubmitted={vi.fn()} />);

    await user.type(screen.getByLabelText("Naam van de zaak"), "Nieuwe Broodjeszaak");
    await user.click(screen.getByText("Versturen"));

    expect(await screen.findByText("Er ging iets mis. Probeer het opnieuw.")).toBeInTheDocument();
  });

  it("resets and calls onClose when cancelled", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RequestModal open onClose={onClose} onSubmitted={vi.fn()} />);

    await user.type(screen.getByLabelText("Naam van de zaak"), "Something");
    await user.click(screen.getByText("Annuleren"));

    expect(onClose).toHaveBeenCalled();
  });
});
