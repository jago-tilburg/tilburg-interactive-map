import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/firebase/auth", () => ({
  sendVisitorMagicLink: vi.fn(),
  VISITOR_AUTH_EMAIL_KEY: "tilburg-visitor-pending-email",
}));

import { VisitorAuthModal } from "@/components/auth/VisitorAuthModal";
import { sendVisitorMagicLink, VISITOR_AUTH_EMAIL_KEY } from "@/lib/firebase/auth";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("VisitorAuthModal", () => {
  it("sends the magic link, stashes the email, and advances to the sent step", async () => {
    vi.mocked(sendVisitorMagicLink).mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    render(<VisitorAuthModal open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("E-mailadres"), "visitor@example.com");
    await user.click(screen.getByText("Verstuur inloglink"));

    expect(sendVisitorMagicLink).toHaveBeenCalledWith("visitor@example.com");
    expect(window.localStorage.getItem(VISITOR_AUTH_EMAIL_KEY)).toBe("visitor@example.com");
    expect(await screen.findByText(/We hebben een inloglink gestuurd/)).toBeInTheDocument();
  });

  it("shows an error message when sending fails", async () => {
    vi.mocked(sendVisitorMagicLink).mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<VisitorAuthModal open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("E-mailadres"), "visitor@example.com");
    await user.click(screen.getByText("Verstuur inloglink"));

    expect(await screen.findByText(/Er ging iets mis/)).toBeInTheDocument();
  });

  it("resets to the request step and calls onClose when cancelled", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<VisitorAuthModal open onClose={onClose} />);

    await user.click(screen.getByText("Annuleren"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
