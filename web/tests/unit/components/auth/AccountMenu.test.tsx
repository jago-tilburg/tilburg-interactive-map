import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/firebase/auth", () => ({
  sendVisitorMagicLink: vi.fn(),
  loginBusiness: vi.fn(),
  registerBusiness: vi.fn(),
  loginAdmin: vi.fn(),
  signOutCurrentUser: vi.fn(),
  VISITOR_AUTH_EMAIL_KEY: "tilburg-visitor-pending-email",
}));

vi.mock("@/lib/firebase/firestore", () => ({
  createBusinessProfile: vi.fn(),
}));

import { AccountMenu } from "@/components/auth/AccountMenu";

beforeEach(() => {
  vi.clearAllMocks();
});

function baseAuth(overrides: Partial<ReturnType<typeof mockUseAuth>> = {}) {
  return {
    currentUser: null,
    isAdmin: false,
    currentVisitor: null,
    currentBusiness: null,
    suppressAutoProfileLoadRef: { current: false },
    ...overrides,
  };
}

describe("AccountMenu label + entry point priority", () => {
  it("shows the admin label when isAdmin is true", () => {
    mockUseAuth.mockReturnValue(baseAuth({ isAdmin: true, currentUser: { uid: "u1" } }));
    render(<AccountMenu />);
    expect(screen.getByText("🛠️ Admin")).toBeInTheDocument();
  });

  it("shows the business label and opens the business dashboard when signed in as a business", async () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        currentUser: { uid: "u1" },
        currentBusiness: { uid: "u1", businessName: "My Shop", email: "biz@example.com", createdAt: null },
      }),
    );
    const user = userEvent.setup();
    render(<AccountMenu />);
    expect(screen.getByText("🎉 My Shop")).toBeInTheDocument();

    await user.click(screen.getByText("🎉 My Shop"));
    expect(screen.getByRole("dialog", { name: "My Shop" })).toBeInTheDocument();
  });

  it("shows the visitor label and opens the visitor dashboard when signed in as a visitor", async () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        currentUser: { uid: "u1" },
        currentVisitor: { uid: "u1", email: "v@example.com", displayName: "v", createdAt: null },
      }),
    );
    const user = userEvent.setup();
    render(<AccountMenu />);
    expect(screen.getByText("👤 v")).toBeInTheDocument();

    await user.click(screen.getByText("👤 v"));
    expect(screen.getByRole("dialog", { name: "Mijn account" })).toBeInTheDocument();
  });

  it("opens the account chooser when signed out", async () => {
    mockUseAuth.mockReturnValue(baseAuth());
    const user = userEvent.setup();
    render(<AccountMenu />);
    expect(screen.getByText("👤 Account")).toBeInTheDocument();

    await user.click(screen.getByText("👤 Account"));
    expect(screen.getByRole("dialog", { name: "Wie ben je?" })).toBeInTheDocument();
  });

  it("shows the admin-login entry only when signed out", () => {
    mockUseAuth.mockReturnValue(baseAuth());
    const { rerender } = render(<AccountMenu />);
    expect(screen.getByText("🔐")).toBeInTheDocument();

    mockUseAuth.mockReturnValue(baseAuth({ currentUser: { uid: "u1" }, isAdmin: true }));
    rerender(<AccountMenu />);
    expect(screen.queryByText("🔐")).not.toBeInTheDocument();
  });
});
