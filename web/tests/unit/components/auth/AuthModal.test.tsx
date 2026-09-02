import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const signInWithPassword = vi.fn();
const registerWithPassword = vi.fn();
const signInWithGoogle = vi.fn();
const sendPasswordReset = vi.fn();
const sendVerificationEmail = vi.fn();
const isNewGoogleUser = vi.fn();
vi.mock("@/lib/firebase/auth", () => ({
  signInWithPassword: (...a: unknown[]) => signInWithPassword(...a),
  registerWithPassword: (...a: unknown[]) => registerWithPassword(...a),
  signInWithGoogle: (...a: unknown[]) => signInWithGoogle(...a),
  sendPasswordReset: (...a: unknown[]) => sendPasswordReset(...a),
  sendVerificationEmail: (...a: unknown[]) => sendVerificationEmail(...a),
  isNewGoogleUser: (...a: unknown[]) => isNewGoogleUser(...a),
}));

const getVisitorProfile = vi.fn();
const createVisitorProfile = vi.fn();
vi.mock("@/lib/firebase/firestore", () => ({
  getVisitorProfile: (...a: unknown[]) => getVisitorProfile(...a),
  createVisitorProfile: (...a: unknown[]) => createVisitorProfile(...a),
}));

import { AuthModal, authErrorMessage } from "@/components/auth/AuthModal";

const suppressAutoProfileLoadRef = { current: false };
const refreshCurrentVisitor = vi.fn();
const refreshCurrentBusiness = vi.fn();

const visitor = { uid: "u1", email: "user@example.com", displayName: "user", createdAt: null as never };

beforeEach(() => {
  vi.clearAllMocks();
  suppressAutoProfileLoadRef.current = false;
  mockUseAuth.mockReturnValue({ suppressAutoProfileLoadRef, refreshCurrentVisitor, refreshCurrentBusiness });
});

describe("authErrorMessage", () => {
  it.each([
    ["auth/email-already-in-use", "Dit e-mailadres is al in gebruik."],
    ["auth/invalid-email", "Ongeldig e-mailadres."],
    ["auth/weak-password", "Wachtwoord is te zwak (minimaal 6 tekens)."],
    ["auth/wrong-password", "Onjuist e-mailadres of wachtwoord."],
    ["auth/invalid-credential", "Onjuist e-mailadres of wachtwoord."],
    ["auth/user-not-found", "Geen account gevonden met dit e-mailadres."],
    ["auth/too-many-requests", "Te veel pogingen. Probeer het later opnieuw."],
    [
      "auth/account-exists-with-different-credential",
      "Dit e-mailadres heeft al een account met een wachtwoord. Log in met je wachtwoord.",
    ],
    ["auth/something-else", "Er ging iets mis. Probeer het opnieuw."],
  ])("maps %s", (code, message) => {
    expect(authErrorMessage({ code })).toBe(message);
  });

  it("falls back to the generic message for a non-Firebase error", () => {
    expect(authErrorMessage(new Error("boom"))).toBe("Er ging iets mis. Probeer het opnieuw.");
  });
});

describe("AuthModal — login", () => {
  it("signs in with an existing visitor profile and reports it", async () => {
    signInWithPassword.mockResolvedValue({ user: { uid: "u1" } });
    getVisitorProfile.mockResolvedValue(visitor);
    const onAuthenticated = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AuthModal open onClose={onClose} onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText("E-mailadres"), "user@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "pw123456");
    await user.click(screen.getByRole("button", { name: "Inloggen" }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(visitor));
    expect(signInWithPassword).toHaveBeenCalledWith("user@example.com", "pw123456");
    expect(onClose).toHaveBeenCalled();
    expect(createVisitorProfile).not.toHaveBeenCalled();
  });

  it("creates a fresh visitor profile (suppressed) when a login somehow has none yet", async () => {
    signInWithPassword.mockResolvedValue({ user: { uid: "u1" } });
    getVisitorProfile.mockResolvedValue(null);
    createVisitorProfile.mockResolvedValue(visitor);
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText("E-mailadres"), "user@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "pw123456");
    await user.click(screen.getByRole("button", { name: "Inloggen" }));

    await waitFor(() => expect(createVisitorProfile).toHaveBeenCalledWith("u1", "user@example.com"));
    expect(refreshCurrentVisitor).toHaveBeenCalledWith("u1");
    expect(suppressAutoProfileLoadRef.current).toBe(false);
    expect(onAuthenticated).toHaveBeenCalledWith(visitor);
  });

  it("shows an error and does not close on a failed login", async () => {
    signInWithPassword.mockRejectedValue({ code: "auth/wrong-password" });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AuthModal open onClose={onClose} onAuthenticated={vi.fn()} />);

    await user.type(screen.getByLabelText("E-mailadres"), "user@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "wrong");
    await user.click(screen.getByRole("button", { name: "Inloggen" }));

    expect(await screen.findByText("Onjuist e-mailadres of wachtwoord.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("switches to the register step and back", async () => {
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Nog geen account? Registreer"));
    expect(screen.getByRole("heading", { name: "Account aanmaken" })).toBeInTheDocument();

    await user.click(screen.getByText("Al een account? Inloggen"));
    expect(screen.getByRole("heading", { name: "Inloggen" })).toBeInTheDocument();
  });

  it("switches to the forgot-password step from the login form", async () => {
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Wachtwoord vergeten?"));
    expect(screen.getByRole("heading", { name: "Wachtwoord vergeten" })).toBeInTheDocument();
  });
});

describe("AuthModal — register", () => {
  it("rejects a password under 8 characters without calling Firebase", async () => {
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Nog geen account? Registreer"));
    await user.type(screen.getByLabelText("E-mailadres"), "user@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "short1");
    await user.click(screen.getByRole("button", { name: "Account aanmaken" }));

    expect(screen.getByText("Wachtwoord moet minimaal 8 tekens zijn.")).toBeInTheDocument();
    expect(registerWithPassword).not.toHaveBeenCalled();
  });

  it("registers, creates a suppressed visitor profile, sends verification, and reports success", async () => {
    registerWithPassword.mockResolvedValue({ user: { uid: "u1", email: "user@example.com" } });
    createVisitorProfile.mockResolvedValue(visitor);
    sendVerificationEmail.mockResolvedValue(undefined);
    const onAuthenticated = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AuthModal open onClose={onClose} onAuthenticated={onAuthenticated} />);

    await user.click(screen.getByText("Nog geen account? Registreer"));
    await user.type(screen.getByLabelText("E-mailadres"), "user@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "pw123456");
    await user.click(screen.getByRole("button", { name: "Account aanmaken" }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(visitor));
    expect(registerWithPassword).toHaveBeenCalledWith("user@example.com", "pw123456");
    expect(createVisitorProfile).toHaveBeenCalledWith("u1", "user@example.com");
    expect(sendVerificationEmail).toHaveBeenCalledWith();
    expect(refreshCurrentVisitor).toHaveBeenCalledWith("u1");
    expect(onClose).toHaveBeenCalled();
  });

  it("still succeeds when the verification email fails to send", async () => {
    registerWithPassword.mockResolvedValue({ user: { uid: "u1", email: "user@example.com" } });
    createVisitorProfile.mockResolvedValue(visitor);
    sendVerificationEmail.mockRejectedValue(new Error("rate limited"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={onAuthenticated} />);

    await user.click(screen.getByText("Nog geen account? Registreer"));
    await user.type(screen.getByLabelText("E-mailadres"), "user@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "pw123456");
    await user.click(screen.getByRole("button", { name: "Account aanmaken" }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith("Verification email error:", expect.any(Error)));
    consoleError.mockRestore();
  });

  it("shows an error on a failed registration", async () => {
    registerWithPassword.mockRejectedValue({ code: "auth/email-already-in-use" });
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Nog geen account? Registreer"));
    await user.type(screen.getByLabelText("E-mailadres"), "user@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "pw123456");
    await user.click(screen.getByRole("button", { name: "Account aanmaken" }));

    expect(await screen.findByText("Dit e-mailadres is al in gebruik.")).toBeInTheDocument();
  });
});

describe("AuthModal — forgot password", () => {
  it("shows the same message whether or not the account exists, on success", async () => {
    sendPasswordReset.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Wachtwoord vergeten?"));
    await user.type(screen.getByLabelText("E-mailadres"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Verstuur link" }));

    expect(await screen.findByText(/Check je inbox/)).toBeInTheDocument();
  });

  it("shows the same message even when sendPasswordReset rejects (e.g. user-not-found)", async () => {
    sendPasswordReset.mockRejectedValue({ code: "auth/user-not-found" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Wachtwoord vergeten?"));
    await user.type(screen.getByLabelText("E-mailadres"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "Verstuur link" }));

    expect(await screen.findByText(/Check je inbox/)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith("Password reset error:", { code: "auth/user-not-found" });
    consoleError.mockRestore();
  });

  it("returns to login from the sent-confirmation screen", async () => {
    sendPasswordReset.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Wachtwoord vergeten?"));
    await user.type(screen.getByLabelText("E-mailadres"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Verstuur link" }));
    await screen.findByText(/Check je inbox/);

    await user.click(screen.getByText("Terug naar inloggen"));
    expect(screen.getByRole("heading", { name: "Inloggen" })).toBeInTheDocument();
  });

  it("returns to login directly from the forgot form (before sending)", async () => {
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Wachtwoord vergeten?"));
    await user.click(screen.getByText("Terug naar inloggen"));
    expect(screen.getByRole("heading", { name: "Inloggen" })).toBeInTheDocument();
  });
});

describe("AuthModal — Google", () => {
  it("does nothing further when signInWithGoogle falls back to a redirect (returns null)", async () => {
    signInWithGoogle.mockResolvedValue(null);
    const onAuthenticated = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AuthModal open onClose={onClose} onAuthenticated={onAuthenticated} />);

    await user.click(screen.getByText("Doorgaan met Google"));

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("creates a suppressed fresh profile for a brand-new Google user", async () => {
    const cred = { user: { uid: "u1", email: "user@example.com" } };
    signInWithGoogle.mockResolvedValue(cred);
    isNewGoogleUser.mockReturnValue(true);
    createVisitorProfile.mockResolvedValue(visitor);
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={onAuthenticated} />);

    await user.click(screen.getByText("Doorgaan met Google"));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(visitor));
    expect(createVisitorProfile).toHaveBeenCalledWith("u1", "user@example.com");
    expect(getVisitorProfile).not.toHaveBeenCalled();
    expect(refreshCurrentBusiness).toHaveBeenCalledWith("u1");
  });

  it("reads the existing profile for a returning Google user", async () => {
    const cred = { user: { uid: "u1", email: "user@example.com" } };
    signInWithGoogle.mockResolvedValue(cred);
    isNewGoogleUser.mockReturnValue(false);
    getVisitorProfile.mockResolvedValue(visitor);
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={onAuthenticated} />);

    await user.click(screen.getByText("Doorgaan met Google"));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(visitor));
    expect(createVisitorProfile).not.toHaveBeenCalled();
  });

  it("creates a profile for a returning Google user whose visitor doc is somehow missing", async () => {
    const cred = { user: { uid: "u1", email: "user@example.com" } };
    signInWithGoogle.mockResolvedValue(cred);
    isNewGoogleUser.mockReturnValue(false);
    getVisitorProfile.mockResolvedValue(null);
    createVisitorProfile.mockResolvedValue(visitor);
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={onAuthenticated} />);

    await user.click(screen.getByText("Doorgaan met Google"));

    await waitFor(() => expect(createVisitorProfile).toHaveBeenCalledWith("u1", "user@example.com"));
    expect(onAuthenticated).toHaveBeenCalledWith(visitor);
  });

  it("silently ignores the user closing the popup themselves", async () => {
    signInWithGoogle.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Doorgaan met Google"));

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error for a real Google sign-in failure", async () => {
    signInWithGoogle.mockRejectedValue({ code: "auth/account-exists-with-different-credential" });
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Doorgaan met Google"));

    expect(
      await screen.findByText("Dit e-mailadres heeft al een account met een wachtwoord. Log in met je wachtwoord."),
    ).toBeInTheDocument();
  });

  it("shows the generic error for a Google failure with no error code at all", async () => {
    signInWithGoogle.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Doorgaan met Google"));

    expect(await screen.findByText("Er ging iets mis. Probeer het opnieuw.")).toBeInTheDocument();
  });

  it("falls back to an empty email when the Google account has none", async () => {
    const cred = { user: { uid: "u1", email: null } };
    signInWithGoogle.mockResolvedValue(cred);
    isNewGoogleUser.mockReturnValue(true);
    createVisitorProfile.mockResolvedValue(visitor);
    const user = userEvent.setup();
    render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Doorgaan met Google"));

    await waitFor(() => expect(createVisitorProfile).toHaveBeenCalledWith("u1", ""));
  });
});

describe("AuthModal close/reset", () => {
  it("resets to the login step when closed and reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("Nog geen account? Registreer"));
    expect(screen.getByRole("heading", { name: "Account aanmaken" })).toBeInTheDocument();

    await user.click(screen.getByLabelText("Sluiten"));
    rerender(<AuthModal open={false} onClose={vi.fn()} onAuthenticated={vi.fn()} />);
    rerender(<AuthModal open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Inloggen" })).toBeInTheDocument();
  });
});
