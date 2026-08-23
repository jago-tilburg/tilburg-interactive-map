import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/firebase/auth", () => ({
  signOutCurrentUser: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

import { BusinessDashboard } from "@/components/auth/BusinessDashboard";
import { signOutCurrentUser } from "@/lib/firebase/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BusinessDashboard", () => {
  it("renders nothing when there is no current business", () => {
    mockUseAuth.mockReturnValue({ currentBusiness: null });
    const { container } = render(<BusinessDashboard open onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the business name/email and signs out on logout", async () => {
    mockUseAuth.mockReturnValue({
      currentBusiness: { uid: "u1", businessName: "My Shop", email: "biz@example.com", createdAt: null },
    });
    vi.mocked(signOutCurrentUser).mockResolvedValue(undefined as never);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "My Shop" })).toBeInTheDocument();
    expect(screen.getByText("biz@example.com")).toBeInTheDocument();
    await user.click(screen.getByText("Uitloggen"));
    expect(signOutCurrentUser).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
