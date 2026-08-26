import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

const signOutCurrentUser = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/firebase/auth", () => ({
  signOutCurrentUser: (...a: unknown[]) => signOutCurrentUser(...a),
}));

// AccountMenu's job is orchestration (which stub opens with which props) —
// its children each get their own test file for their actual behavior, so
// they're stubbed here rather than exercised end-to-end.
vi.mock("@/components/auth/AuthModal", () => ({
  AuthModal: ({
    open,
    onClose,
    onAuthenticated,
  }: {
    open: boolean;
    onClose: () => void;
    onAuthenticated: (visitor: { uid: string; marketingConsentAt?: unknown }) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="AuthModal-stub">
        <button onClick={onClose}>close-auth</button>
        <button onClick={() => onAuthenticated({ uid: "u1", marketingConsentAt: undefined })}>
          authenticate-needs-onboarding
        </button>
        <button onClick={() => onAuthenticated({ uid: "u1", marketingConsentAt: { seconds: 1 } })}>
          authenticate-onboarded
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/auth/PostAuthFlow", () => ({
  PostAuthFlow: ({
    open,
    onClose,
    startStep,
    onOpenProfile,
    onGoToBusiness,
  }: {
    open: boolean;
    onClose: () => void;
    startStep: string;
    onOpenProfile: () => void;
    onGoToBusiness: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label={`PostAuthFlow-${startStep}`}>
        <button onClick={onClose}>close-postauth</button>
        <button onClick={onOpenProfile}>postauth-open-profile</button>
        <button onClick={onGoToBusiness}>postauth-go-to-business</button>
      </div>
    ) : null,
}));

vi.mock("@/components/auth/VisitorDashboard", () => ({
  VisitorDashboard: ({
    open,
    onClose,
    onOpenShop,
    onOpenEvent,
  }: {
    open: boolean;
    onClose: () => void;
    onOpenShop: (id: number) => void;
    onOpenEvent: (id: string) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Mijn account">
        <button onClick={onClose}>close-visitor</button>
        <button onClick={() => onOpenShop(42)}>visitor-open-shop</button>
        <button onClick={() => onOpenEvent("evt1")}>visitor-open-event</button>
      </div>
    ) : null,
}));

vi.mock("@/components/admin/AdminPanel", () => ({
  AdminPanel: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Beheerpaneel">
        <button onClick={onClose}>close-admin</button>
      </div>
    ) : null,
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
    ...overrides,
  };
}

describe("AccountMenu — signed out", () => {
  it("shows an 'Inloggen' button and opens AuthModal", async () => {
    mockUseAuth.mockReturnValue(baseAuth());
    const user = userEvent.setup();
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);

    const btn = screen.getByRole("button", { name: "Inloggen" });
    await user.click(btn);
    expect(screen.getByRole("dialog", { name: "AuthModal-stub" })).toBeInTheDocument();
  });

  it("opens PostAuthFlow at 'onboarding' when a fresh account authenticates", async () => {
    mockUseAuth.mockReturnValue(baseAuth());
    const user = userEvent.setup();
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Inloggen" }));
    await user.click(screen.getByText("authenticate-needs-onboarding"));

    expect(screen.getByRole("dialog", { name: "PostAuthFlow-onboarding" })).toBeInTheDocument();
  });

  it("opens PostAuthFlow at 'chooser' when a returning account authenticates", async () => {
    mockUseAuth.mockReturnValue(baseAuth());
    const user = userEvent.setup();
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Inloggen" }));
    await user.click(screen.getByText("authenticate-onboarded"));

    expect(screen.getByRole("dialog", { name: "PostAuthFlow-chooser" })).toBeInTheDocument();
  });

  it("closes AuthModal via its own close callback", async () => {
    mockUseAuth.mockReturnValue(baseAuth());
    const user = userEvent.setup();
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Inloggen" }));
    await user.click(screen.getByText("close-auth"));
    expect(screen.queryByRole("dialog", { name: "AuthModal-stub" })).not.toBeInTheDocument();
  });

  it("closes PostAuthFlow via its own close callback, and opens the profile from its 'open profile' callback", async () => {
    mockUseAuth.mockReturnValue(baseAuth());
    const user = userEvent.setup();
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Inloggen" }));
    await user.click(screen.getByText("authenticate-onboarded"));
    await user.click(screen.getByText("close-postauth"));
    expect(screen.queryByRole("dialog", { name: "PostAuthFlow-chooser" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Inloggen" }));
    await user.click(screen.getByText("authenticate-onboarded"));
    await user.click(screen.getByText("postauth-open-profile"));
    expect(screen.getByRole("dialog", { name: "Mijn account" })).toBeInTheDocument();
  });
});

describe("AccountMenu — signed in", () => {
  it("labels the trigger with the visitor's display name", () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        currentUser: { uid: "u1" },
        currentVisitor: { uid: "u1", email: "v@example.com", displayName: "Jago", createdAt: null },
      }),
    );
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Jago" })).toBeInTheDocument();
  });

  it("labels the trigger 'Admin' when isAdmin is true, even with a visitor profile too", () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        isAdmin: true,
        currentUser: { uid: "u1" },
        currentVisitor: { uid: "u1", email: "a@example.com", displayName: "Jago", createdAt: null },
      }),
    );
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Admin" })).toBeInTheDocument();
  });

  it("opens the visitor dashboard from 'Mijn profiel' and forwards shop/event selection", async () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        currentUser: { uid: "u1" },
        currentVisitor: { uid: "u1", email: "v@example.com", displayName: "Jago", createdAt: null },
      }),
    );
    const onOpenShop = vi.fn();
    const onOpenEvent = vi.fn();
    const user = userEvent.setup();
    render(<AccountMenu onOpenShop={onOpenShop} onOpenEvent={onOpenEvent} />);

    await user.click(screen.getByRole("button", { name: "Jago" }));
    await user.click(await screen.findByText("👤 Mijn profiel"));
    expect(screen.getByRole("dialog", { name: "Mijn account" })).toBeInTheDocument();

    await user.click(screen.getByText("visitor-open-shop"));
    expect(onOpenShop).toHaveBeenCalledWith(42);
    expect(screen.queryByRole("dialog", { name: "Mijn account" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Jago" }));
    await user.click(await screen.findByText("👤 Mijn profiel"));
    await user.click(screen.getByText("visitor-open-event"));
    expect(onOpenEvent).toHaveBeenCalledWith("evt1");
    expect(screen.queryByRole("dialog", { name: "Mijn account" })).not.toBeInTheDocument();
  });

  it("closes the visitor dashboard via its own close callback", async () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        currentUser: { uid: "u1" },
        currentVisitor: { uid: "u1", email: "v@example.com", displayName: "Jago", createdAt: null },
      }),
    );
    const user = userEvent.setup();
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Jago" }));
    await user.click(await screen.findByText("👤 Mijn profiel"));
    await user.click(screen.getByText("close-visitor"));
    expect(screen.queryByRole("dialog", { name: "Mijn account" })).not.toBeInTheDocument();
  });

  it("shows 'Bedrijfsomgeving' and navigates to /bedrijf when a business profile exists", async () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        currentUser: { uid: "u1" },
        currentVisitor: { uid: "u1", email: "v@example.com", displayName: "Jago", createdAt: null },
        currentBusiness: { uid: "u1", businessName: "My Shop", email: "v@example.com", createdAt: null },
      }),
    );
    const user = userEvent.setup();
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Jago" }));
    await user.click(await screen.findByText("🏢 Bedrijfsomgeving"));
    expect(routerPush).toHaveBeenCalledWith("/bedrijf");
  });

  it("shows 'Event-profiel aanmaken' and opens PostAuthFlow at 'createBusiness' when there is none", async () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        currentUser: { uid: "u1" },
        currentVisitor: { uid: "u1", email: "v@example.com", displayName: "Jago", createdAt: null },
      }),
    );
    const user = userEvent.setup();
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Jago" }));
    await user.click(await screen.findByText("🏢 Event-profiel aanmaken"));
    expect(screen.getByRole("dialog", { name: "PostAuthFlow-createBusiness" })).toBeInTheDocument();
  });

  it("shows 'Adminpaneel' only for an admin, opens it, and closes via its own callback", async () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        isAdmin: true,
        currentUser: { uid: "u1" },
        currentVisitor: { uid: "u1", email: "a@example.com", displayName: "Jago", createdAt: null },
      }),
    );
    const user = userEvent.setup();
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Admin" }));
    await user.click(await screen.findByText("🔐 Adminpaneel"));
    expect(screen.getByRole("dialog", { name: "Beheerpaneel" })).toBeInTheDocument();

    await user.click(screen.getByText("close-admin"));
    expect(screen.queryByRole("dialog", { name: "Beheerpaneel" })).not.toBeInTheDocument();
  });

  it("does not show 'Adminpaneel' for a non-admin", async () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        currentUser: { uid: "u1" },
        currentVisitor: { uid: "u1", email: "v@example.com", displayName: "Jago", createdAt: null },
      }),
    );
    const user = userEvent.setup();
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Jago" }));
    expect(await screen.findByText("👤 Mijn profiel")).toBeInTheDocument();
    expect(screen.queryByText("🔐 Adminpaneel")).not.toBeInTheDocument();
  });

  it("signs out via 'Uitloggen'", async () => {
    mockUseAuth.mockReturnValue(
      baseAuth({
        currentUser: { uid: "u1" },
        currentVisitor: { uid: "u1", email: "v@example.com", displayName: "Jago", createdAt: null },
      }),
    );
    const user = userEvent.setup();
    render(<AccountMenu onOpenShop={vi.fn()} onOpenEvent={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Jago" }));
    await user.click(await screen.findByText("Uitloggen"));
    expect(signOutCurrentUser).toHaveBeenCalled();
  });
});
