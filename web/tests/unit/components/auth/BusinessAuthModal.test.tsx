import { describe, it, expect, vi, beforeEach, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/firebase/auth", () => ({
  loginBusiness: vi.fn(),
  registerBusiness: vi.fn(),
}));

vi.mock("@/lib/firebase/firestore", () => ({
  createBusinessProfile: vi.fn(),
}));

const suppressRef = { current: false };
const refreshCurrentBusiness = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ suppressAutoProfileLoadRef: suppressRef, refreshCurrentBusiness }),
}));

import { BusinessAuthModal } from "@/components/auth/BusinessAuthModal";
import { loginBusiness, registerBusiness } from "@/lib/firebase/auth";
import { createBusinessProfile } from "@/lib/firebase/firestore";

beforeEach(() => {
  vi.clearAllMocks();
  suppressRef.current = false;
  refreshCurrentBusiness.mockResolvedValue(undefined);
});

describe("BusinessAuthModal login step", () => {
  it("logs in and closes on success", async () => {
    vi.mocked(loginBusiness).mockResolvedValue(undefined as never);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BusinessAuthModal open onClose={onClose} />);

    await user.type(screen.getByLabelText("E-mailadres"), "biz@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "secret123");
    await user.click(screen.getByRole("button", { name: "Inloggen" }));

    expect(loginBusiness).toHaveBeenCalledWith("biz@example.com", "secret123");
    expect(onClose).toHaveBeenCalled();
  });

  it("maps auth/wrong-password to a Dutch error message", async () => {
    vi.mocked(loginBusiness).mockRejectedValue({ code: "auth/wrong-password" });
    const user = userEvent.setup();
    render(<BusinessAuthModal open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("E-mailadres"), "biz@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "wrong");
    await user.click(screen.getByRole("button", { name: "Inloggen" }));

    expect(await screen.findByText("Onjuist e-mailadres of wachtwoord.")).toBeInTheDocument();
  });

  test.each([
    ["auth/invalid-email", "Ongeldig e-mailadres."],
    ["auth/weak-password", "Wachtwoord is te zwak (minimaal 6 tekens)."],
    ["auth/user-not-found", "Geen account gevonden met dit e-mailadres."],
    ["auth/too-many-requests", "Te veel pogingen. Probeer het later opnieuw."],
    ["auth/something-unmapped", "Er ging iets mis. Probeer het opnieuw."],
  ])("maps %s to %s", async (code, message) => {
    vi.mocked(loginBusiness).mockRejectedValue({ code });
    const user = userEvent.setup();
    render(<BusinessAuthModal open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("E-mailadres"), "biz@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "secret123");
    await user.click(screen.getByRole("button", { name: "Inloggen" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("falls back to the default error message when the rejection isn't a Firebase error object", async () => {
    vi.mocked(loginBusiness).mockRejectedValue(null);
    const user = userEvent.setup();
    render(<BusinessAuthModal open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("E-mailadres"), "biz@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "secret123");
    await user.click(screen.getByRole("button", { name: "Inloggen" }));

    expect(await screen.findByText("Er ging iets mis. Probeer het opnieuw.")).toBeInTheDocument();
  });
});

describe("BusinessAuthModal register step", () => {
  it("switches to the register step and validates business name + password length", async () => {
    const user = userEvent.setup();
    render(<BusinessAuthModal open onClose={vi.fn()} />);

    await user.click(screen.getByText("Nog geen account? Registreer"));
    await user.type(screen.getByLabelText("E-mailadres"), "biz@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "short");
    await user.click(screen.getByRole("button", { name: "Account aanmaken" }));

    expect(screen.getByText("Bedrijfsnaam is verplicht.")).toBeInTheDocument();
    expect(registerBusiness).not.toHaveBeenCalled();
  });

  it("validates password length separately from the business-name check", async () => {
    const user = userEvent.setup();
    render(<BusinessAuthModal open onClose={vi.fn()} />);

    await user.click(screen.getByText("Nog geen account? Registreer"));
    await user.type(screen.getByLabelText("Bedrijfsnaam"), "My Shop");
    await user.type(screen.getByLabelText("E-mailadres"), "biz@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "short");
    await user.click(screen.getByRole("button", { name: "Account aanmaken" }));

    expect(screen.getByText("Wachtwoord moet minimaal 6 tekens zijn.")).toBeInTheDocument();
    expect(registerBusiness).not.toHaveBeenCalled();
  });

  it("shows a mapped error message when registration fails", async () => {
    vi.mocked(registerBusiness).mockRejectedValue({ code: "auth/email-already-in-use" });
    const user = userEvent.setup();
    render(<BusinessAuthModal open onClose={vi.fn()} />);

    await user.click(screen.getByText("Nog geen account? Registreer"));
    await user.type(screen.getByLabelText("Bedrijfsnaam"), "My Shop");
    await user.type(screen.getByLabelText("E-mailadres"), "biz@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "secret123");
    await user.click(screen.getByRole("button", { name: "Account aanmaken" }));

    expect(await screen.findByText("Dit e-mailadres is al in gebruik.")).toBeInTheDocument();
    expect(suppressRef.current).toBe(false);
  });

  it("switches back from the register step to the login step", async () => {
    const user = userEvent.setup();
    render(<BusinessAuthModal open onClose={vi.fn()} />);

    await user.click(screen.getByText("Nog geen account? Registreer"));
    expect(screen.getByLabelText("Bedrijfsnaam")).toBeInTheDocument();

    await user.click(screen.getByText("Al een account? Inloggen"));
    expect(screen.queryByLabelText("Bedrijfsnaam")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inloggen" })).toBeInTheDocument();
  });

  it("sets suppressAutoProfileLoadRef around registration and creates the profile", async () => {
    vi.mocked(registerBusiness).mockResolvedValue({ user: { uid: "new-uid" } } as never);
    vi.mocked(createBusinessProfile).mockImplementation(async () => {
      expect(suppressRef.current).toBe(true);
      return { uid: "new-uid", businessName: "My Shop", email: "biz@example.com", createdAt: null as never };
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BusinessAuthModal open onClose={onClose} />);

    await user.click(screen.getByText("Nog geen account? Registreer"));
    await user.type(screen.getByLabelText("Bedrijfsnaam"), "My Shop");
    await user.type(screen.getByLabelText("E-mailadres"), "biz@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "secret123");
    await user.click(screen.getByRole("button", { name: "Account aanmaken" }));

    expect(registerBusiness).toHaveBeenCalledWith("biz@example.com", "secret123");
    expect(createBusinessProfile).toHaveBeenCalledWith("new-uid", "My Shop", "biz@example.com");
    expect(suppressRef.current).toBe(false);
    expect(onClose).toHaveBeenCalled();
    // Regression: without this, currentBusiness stayed null for the rest
    // of the session after a real registration — nothing else re-triggers
    // a profile fetch once suppressAutoProfileLoadRef goes back to false,
    // since the auth-state listener only reacts to actual auth changes.
    expect(refreshCurrentBusiness).toHaveBeenCalledWith("new-uid");
  });
});
