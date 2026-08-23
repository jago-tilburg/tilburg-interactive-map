import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
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
  subscribeVisitorProfile: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/firebase/businessEvents", () => ({
  subscribeMyBusinessEvents: vi.fn(() => vi.fn()),
  subscribeAllBusinessEventsForAdmin: vi.fn(() => vi.fn()),
  subscribeApprovedBusinessEvents: vi.fn(() => vi.fn()),
  deleteBusinessEvent: vi.fn(),
}));

vi.mock("@/lib/firebase/shops", () => ({
  subscribeShops: vi.fn(() => vi.fn()),
  deleteShop: vi.fn(),
  getShopViews: vi.fn().mockResolvedValue(0),
  createShop: vi.fn(),
  updateShop: vi.fn(),
}));

vi.mock("@/lib/firebase/requests", () => ({
  subscribeRequests: vi.fn(() => vi.fn()),
  deleteRequest: vi.fn(),
}));

vi.mock("@/lib/firebase/umbrellaEvents", () => ({
  subscribeUmbrellaEvents: vi.fn(() => vi.fn()),
  createUmbrellaEvent: vi.fn(),
  updateUmbrellaEvent: vi.fn(),
  deleteUmbrellaEvent: vi.fn(),
}));

vi.mock("@/lib/firebase/functions", () => ({
  approveEvent: vi.fn(),
  rejectEvent: vi.fn(),
  confirmEventPaymentStub: vi.fn(),
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

  it("opens and closes the admin events panel when isAdmin is true", async () => {
    mockUseAuth.mockReturnValue(baseAuth({ isAdmin: true, currentUser: { uid: "u1" } }));
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByText("🛠️ Admin"));
    expect(screen.getByRole("dialog", { name: "Beheerpaneel" })).toBeInTheDocument();

    await user.click(screen.getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

  it("opens the admin login modal from the 🔐 entry", async () => {
    mockUseAuth.mockReturnValue(baseAuth());
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByText("🔐"));
    expect(screen.getByRole("dialog", { name: "Admin inloggen" })).toBeInTheDocument();
  });

  it("closes the account chooser modal when cancelled", async () => {
    mockUseAuth.mockReturnValue(baseAuth());
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByText("👤 Account"));
    expect(screen.getByRole("dialog", { name: "Wie ben je?" })).toBeInTheDocument();

    await user.click(screen.getByText("Annuleren"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the business dashboard modal", async () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        currentUser: { uid: "u1" },
        currentBusiness: { uid: "u1", businessName: "My Shop", email: "biz@example.com", createdAt: null },
      }),
    );
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByText("🎉 My Shop"));
    await user.click(screen.getByText("Sluiten"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the admin login modal", async () => {
    mockUseAuth.mockReturnValue(baseAuth());
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByText("🔐"));
    await user.click(screen.getByText("Annuleren"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the visitor auth modal reached via the chooser", async () => {
    mockUseAuth.mockReturnValue(baseAuth());
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByText("👤 Account"));
    await user.click(screen.getByText("👤 Ik ben bezoeker"));
    expect(screen.getByRole("dialog", { name: "Inloggen als bezoeker" })).toBeInTheDocument();

    await user.click(screen.getByText("Annuleren"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens and closes the business auth modal reached via the chooser", async () => {
    mockUseAuth.mockReturnValue(baseAuth());
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByText("👤 Account"));
    await user.click(screen.getByText("🎉 Ik ben Event Owner"));
    expect(screen.getByRole("dialog", { name: "Inloggen" })).toBeInTheDocument();

    await user.click(screen.getByText("Nog geen account? Registreer"));
    expect(screen.getByRole("dialog", { name: "Account aanmaken" })).toBeInTheDocument();

    await user.click(screen.getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the visitor dashboard modal", async () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        currentUser: { uid: "u1" },
        currentVisitor: { uid: "u1", email: "v@example.com", displayName: "v", createdAt: null },
      }),
    );
    const user = userEvent.setup();
    render(<AccountMenu />);

    await user.click(screen.getByText("👤 v"));
    await user.click(screen.getByText("Sluiten"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
