import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/firebase/auth", () => ({
  loginAdmin: vi.fn(),
}));

import { AdminLoginModal } from "@/components/auth/AdminLoginModal";
import { loginAdmin } from "@/lib/firebase/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminLoginModal", () => {
  it("logs in and closes on success", async () => {
    vi.mocked(loginAdmin).mockResolvedValue(undefined as never);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AdminLoginModal open onClose={onClose} />);

    await user.type(screen.getByLabelText("E-mailadres"), "admin@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "secret123");
    await user.click(screen.getByText("Inloggen"));

    expect(loginAdmin).toHaveBeenCalledWith("admin@example.com", "secret123");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error message on failed login", async () => {
    vi.mocked(loginAdmin).mockRejectedValue(new Error("bad credentials"));
    const user = userEvent.setup();
    render(<AdminLoginModal open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("E-mailadres"), "admin@example.com");
    await user.type(screen.getByLabelText("Wachtwoord"), "wrong");
    await user.click(screen.getByText("Inloggen"));

    expect(await screen.findByText(/Inloggen mislukt/)).toBeInTheDocument();
  });
});
