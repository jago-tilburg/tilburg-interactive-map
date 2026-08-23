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

import { VisitorDashboard } from "@/components/auth/VisitorDashboard";
import { signOutCurrentUser } from "@/lib/firebase/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VisitorDashboard", () => {
  it("renders nothing when there is no current visitor", () => {
    mockUseAuth.mockReturnValue({ currentVisitor: null });
    const { container } = render(<VisitorDashboard open onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the visitor email and signs out on logout", async () => {
    mockUseAuth.mockReturnValue({
      currentVisitor: { uid: "u1", email: "visitor@example.com", displayName: "visitor", createdAt: null },
    });
    vi.mocked(signOutCurrentUser).mockResolvedValue(undefined as never);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<VisitorDashboard open onClose={onClose} />);

    expect(screen.getByText("visitor@example.com")).toBeInTheDocument();
    await user.click(screen.getByText("Uitloggen"));
    expect(signOutCurrentUser).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
