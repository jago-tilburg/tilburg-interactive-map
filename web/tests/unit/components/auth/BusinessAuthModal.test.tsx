import { describe, it, expect, vi, beforeEach } from "vitest";
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
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ suppressAutoProfileLoadRef: suppressRef }),
}));

import { BusinessAuthModal } from "@/components/auth/BusinessAuthModal";
import { loginBusiness, registerBusiness } from "@/lib/firebase/auth";
import { createBusinessProfile } from "@/lib/firebase/firestore";

beforeEach(() => {
  vi.clearAllMocks();
  suppressRef.current = false;
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
  });
});
