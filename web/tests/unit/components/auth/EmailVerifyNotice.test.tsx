import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const showToast = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast }),
}));

const sendVerificationEmail = vi.fn();
vi.mock("@/lib/firebase/auth", () => ({
  sendVerificationEmail: (...a: unknown[]) => sendVerificationEmail(...a),
}));

import { EmailVerifyNotice } from "@/components/auth/EmailVerifyNotice";

const refreshEmailVerified = vi.fn();

function authState(overrides: Record<string, unknown> = {}) {
  return {
    currentUser: { uid: "u1", email: "user@example.com" },
    currentVisitor: { uid: "u1", email: "user@example.com", displayName: "user", createdAt: null },
    emailVerified: false,
    refreshEmailVerified,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.sessionStorage.clear();
  mockUseAuth.mockReturnValue(authState());
  refreshEmailVerified.mockResolvedValue(false);
  sendVerificationEmail.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EmailVerifyNotice visibility", () => {
  it("renders when signed in with an unverified email", () => {
    render(<EmailVerifyNotice />);
    expect(screen.getByText("Bevestig je e-mailadres")).toBeInTheDocument();
    expect(screen.getByText("We hebben een link gestuurd naar user@example.com")).toBeInTheDocument();
  });

  it("is invisible once emailVerified is true (Google users, or after confirming)", () => {
    mockUseAuth.mockReturnValue(authState({ emailVerified: true }));
    const { container } = render(<EmailVerifyNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is invisible when signed out", () => {
    mockUseAuth.mockReturnValue(authState({ currentUser: null, currentVisitor: null }));
    const { container } = render(<EmailVerifyNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden for the rest of the session once dismissed, restored on next mount only if sessionStorage is cleared", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<EmailVerifyNotice />);

    await user.click(screen.getByLabelText("Sluiten"));
    expect(screen.queryByText("Bevestig je e-mailadres")).not.toBeInTheDocument();

    unmount();
    render(<EmailVerifyNotice />);
    expect(screen.queryByText("Bevestig je e-mailadres")).not.toBeInTheDocument();

    window.sessionStorage.clear();
    render(<EmailVerifyNotice />);
    expect(screen.getAllByText("Bevestig je e-mailadres").length).toBeGreaterThan(0);
  });
});

describe("EmailVerifyNotice — 'Ik heb het bevestigd'", () => {
  it("shows a toast when still not verified after checking", async () => {
    refreshEmailVerified.mockResolvedValue(false);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EmailVerifyNotice />);

    await user.click(screen.getByText("Ik heb het bevestigd"));

    expect(refreshEmailVerified).toHaveBeenCalled();
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Nog niet bevestigd. Check je inbox.", "info"));
  });

  it("shows no toast when the address is now verified — the strip disappears via the emailVerified state itself", async () => {
    refreshEmailVerified.mockResolvedValue(true);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EmailVerifyNotice />);

    await user.click(screen.getByText("Ik heb het bevestigd"));

    await waitFor(() => expect(refreshEmailVerified).toHaveBeenCalled());
    expect(showToast).not.toHaveBeenCalled();
  });
});

describe("EmailVerifyNotice — resend", () => {
  it("resends, starts a 60s cooldown, and disables the button meanwhile", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EmailVerifyNotice />);

    await user.click(screen.getByText("Opnieuw versturen"));

    expect(sendVerificationEmail).toHaveBeenCalledWith({ uid: "u1", email: "user@example.com" });
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Verificatiemail opnieuw verstuurd.", "success"));
    expect(screen.getByRole("button", { name: "Opnieuw versturen (60s)" })).toBeDisabled();
  });

  it("counts down and re-enables after the cooldown elapses", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EmailVerifyNotice />);

    await user.click(screen.getByText("Opnieuw versturen"));
    expect(await screen.findByRole("button", { name: "Opnieuw versturen (60s)" })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByRole("button", { name: "Opnieuw versturen (59s)" })).toBeInTheDocument();

    for (let i = 0; i < 59; i++) {
      await act(() => vi.advanceTimersByTimeAsync(1000));
    }
    expect(screen.getByRole("button", { name: "Opnieuw versturen" })).not.toBeDisabled();
  });

  it("shows an error toast when resending fails", async () => {
    sendVerificationEmail.mockRejectedValue(new Error("rate limited"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EmailVerifyNotice />);

    await user.click(screen.getByText("Opnieuw versturen"));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Versturen mislukt. Probeer het later opnieuw.", "error"));
  });

  it("ignores clicks while the cooldown is active", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EmailVerifyNotice />);

    await user.click(screen.getByText("Opnieuw versturen"));
    await user.click(screen.getByRole("button", { name: "Opnieuw versturen (60s)" }));

    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
  });
});

describe("EmailVerifyNotice — visibilitychange", () => {
  it("re-checks verification when the tab becomes visible again", () => {
    render(<EmailVerifyNotice />);
    refreshEmailVerified.mockClear();

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    fireEvent(document, new Event("visibilitychange"));

    expect(refreshEmailVerified).toHaveBeenCalled();
  });

  it("does not re-check when the tab becomes hidden", () => {
    render(<EmailVerifyNotice />);
    refreshEmailVerified.mockClear();

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    fireEvent(document, new Event("visibilitychange"));

    expect(refreshEmailVerified).not.toHaveBeenCalled();
  });
});
