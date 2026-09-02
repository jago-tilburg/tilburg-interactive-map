import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Shop } from "@/types/shops";
import type { BusinessEvent } from "@/types/events";
import type { Visitor, Business } from "@/types/account";

const deleteCurrentUser = vi.fn();
const changeAccountPassword = vi.fn();
vi.mock("@/lib/firebase/auth", () => ({
  signOutCurrentUser: vi.fn(),
  deleteCurrentUser: (...a: unknown[]) => deleteCurrentUser(...a),
  changeAccountPassword: (...a: unknown[]) => changeAccountPassword(...a),
}));

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const showToast = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast }),
}));

const routerPush = vi.fn();
const routerReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
}));

const subscribeVisitorProfile = vi.fn();
const deleteAccountCascade = vi.fn();
const updateMarketingConsent = vi.fn();
vi.mock("@/lib/firebase/firestore", () => ({
  subscribeVisitorProfile: (...a: unknown[]) => subscribeVisitorProfile(...a),
  deleteAccountCascade: (...a: unknown[]) => deleteAccountCascade(...a),
  updateMarketingConsent: (...a: unknown[]) => updateMarketingConsent(...a),
}));

const subscribeShops = vi.fn();
vi.mock("@/lib/firebase/shops", () => ({
  subscribeShops: (...a: unknown[]) => subscribeShops(...a),
}));

const subscribeApprovedBusinessEvents = vi.fn();
vi.mock("@/lib/firebase/businessEvents", () => ({
  subscribeApprovedBusinessEvents: (...a: unknown[]) => subscribeApprovedBusinessEvents(...a),
}));

import { ProfileShell } from "@/components/profile/ProfileShell";
import { signOutCurrentUser } from "@/lib/firebase/auth";

const visitor: Visitor = {
  uid: "u1",
  email: "visitor@example.com",
  displayName: "visitor",
  createdAt: null as never,
  savedEventIds: ["evt1"],
};

const business: Business = {
  uid: "u1",
  businessName: "My Shop",
  email: "visitor@example.com",
  createdAt: null as never,
};

const shop: Shop = {
  id: 9001,
  name: "Café Zuid",
  address: "Heuvelstraat 1",
  lat: 51.5,
  lng: 5.09,
  rating: 8,
  price: "€€",
  photoUrl: "",
  review: "",
  tiktokUrl: "",
  instagramUrl: "",
  dietaryOptions: { glutenvrij: false, halal: false, vega: false },
  createdAt: "2026-01-01",
  likes: ["u1"],
  comments: [],
  userReviews: [],
  userRatings: [{ userId: "u1", rating: 7.5, createdAt: 1 }],
};

const otherShop: Shop = { ...shop, id: 9002, name: "Unrelated Shop", likes: [], userRatings: [] };

const event: BusinessEvent = {
  id: "evt1",
  title: "Kermis",
  category: "anders",
  description: "",
  startDate: "2026-09-01",
  endDate: "2026-09-01",
  startTime: "10:00",
  endTime: "18:00",
  address: "Heuvelplein 1",
  lat: 51.5,
  lng: 5.09,
  ownerId: "owner-uid",
  status: "approved",
  paid: true,
  createdAt: null as never,
};

const refreshCurrentVisitor = vi.fn();

function authState(overrides: Record<string, unknown> = {}) {
  return {
    currentUser: { uid: "u1" },
    currentVisitor: visitor,
    currentBusiness: null,
    loading: false,
    refreshCurrentVisitor,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue(authState());
  deleteAccountCascade.mockResolvedValue(undefined);
  deleteCurrentUser.mockResolvedValue(undefined);
  changeAccountPassword.mockResolvedValue(undefined);
  updateMarketingConsent.mockResolvedValue(undefined);
  subscribeVisitorProfile.mockImplementation((_uid: string, onChange: (v: Visitor | null) => void) => {
    onChange(visitor);
    return vi.fn();
  });
  subscribeShops.mockImplementation((onChange: (s: Shop[]) => void) => {
    onChange([shop, otherShop]);
    return vi.fn();
  });
  subscribeApprovedBusinessEvents.mockImplementation((onChange: (e: BusinessEvent[]) => void) => {
    onChange([event]);
    return vi.fn();
  });
});

describe("ProfileShell — guard", () => {
  it("renders nothing and redirects to the map when signed out once loading finishes", () => {
    mockUseAuth.mockReturnValue(authState({ currentVisitor: null }));
    const { container } = render(<ProfileShell />);
    expect(container).toBeEmptyDOMElement();
    expect(routerReplace).toHaveBeenCalledWith("/");
  });

  it("renders nothing (no redirect yet) while still loading", () => {
    mockUseAuth.mockReturnValue(authState({ currentVisitor: null, loading: true }));
    render(<ProfileShell />);
    expect(routerReplace).not.toHaveBeenCalledWith("/");
  });

  it("does not subscribe to any data when signed out", () => {
    mockUseAuth.mockReturnValue(authState({ currentVisitor: null }));
    render(<ProfileShell />);
    expect(subscribeShops).not.toHaveBeenCalled();
  });
});

describe("ProfileShell", () => {
  it("shows the brand, the back link, and the visitor email", () => {
    render(<ProfileShell />);
    expect(screen.getByText("2happies")).toBeInTheDocument();
    expect(screen.getByText("← Naar de kaart")).toBeInTheDocument();
    expect(screen.getByText("visitor@example.com")).toBeInTheDocument();
  });

  it("navigates to the map from the back link", async () => {
    const user = userEvent.setup();
    render(<ProfileShell />);
    await user.click(screen.getByText("← Naar de kaart"));
    expect(routerPush).toHaveBeenCalledWith("/");
  });

  it("signs out and navigates to the map on logout", async () => {
    vi.mocked(signOutCurrentUser).mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    render(<ProfileShell />);

    await user.click(screen.getByText("Uitloggen"));
    expect(signOutCurrentUser).toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalledWith("/");
  });

  it("shows liked shops, ratings given, and saved events for the visitor only", () => {
    render(<ProfileShell />);

    expect(screen.getByText("Café Zuid")).toBeInTheDocument();
    expect(screen.queryByText("Unrelated Shop")).not.toBeInTheDocument();
    expect(screen.getByText(/Café Zuid — 7.5 ⭐/)).toBeInTheDocument();
    expect(screen.getByText(/Kermis/)).toBeInTheDocument();
  });

  it("navigates to the shop or event detail route when a list item is clicked", async () => {
    const user = userEvent.setup();
    render(<ProfileShell />);

    await user.click(screen.getByText("Café Zuid"));
    expect(routerPush).toHaveBeenCalledWith("/shop/9001");

    await user.click(screen.getByText(/Café Zuid — 7.5 ⭐/));
    expect(routerPush).toHaveBeenCalledWith("/shop/9001");

    await user.click(screen.getByText(/Kermis/));
    expect(routerPush).toHaveBeenCalledWith("/event/evt1");
  });

  it("shows empty states when the visitor has no likes, ratings, or saved events", () => {
    mockUseAuth.mockReturnValue(authState({ currentVisitor: { ...visitor, savedEventIds: [] } }));
    subscribeVisitorProfile.mockImplementation((_uid: string, onChange: (v: Visitor | null) => void) => {
      onChange({ ...visitor, savedEventIds: [] });
      return vi.fn();
    });
    subscribeShops.mockImplementation((onChange: (s: Shop[]) => void) => {
      onChange([otherShop]);
      return vi.fn();
    });
    render(<ProfileShell />);

    expect(screen.getByText("Nog geen shops geliked.")).toBeInTheDocument();
    expect(screen.getByText("Nog geen ratings gegeven.")).toBeInTheDocument();
    expect(screen.getByText("Nog geen evenementen bewaard.")).toBeInTheDocument();
  });

  it("falls back to the cached savedEventIds before the live profile subscription resolves", () => {
    subscribeVisitorProfile.mockImplementation(() => vi.fn());
    render(<ProfileShell />);
    expect(screen.getByText(/Kermis/)).toBeInTheDocument();
  });

  it("no-ops when there is no current auth user", async () => {
    mockUseAuth.mockReturnValue(authState({ currentUser: null }));
    const user = userEvent.setup();
    render(<ProfileShell />);

    await user.click(screen.getByText("Account verwijderen"));

    expect(deleteAccountCascade).not.toHaveBeenCalled();
  });

  it("deletes the whole account (business side too) and the auth user, then navigates to the map", async () => {
    const user = userEvent.setup();
    render(<ProfileShell />);

    await user.click(screen.getByText("Account verwijderen"));

    expect(deleteAccountCascade).toHaveBeenCalledWith("u1");
    expect(deleteCurrentUser).toHaveBeenCalledWith({ uid: "u1" });
    expect(routerPush).toHaveBeenCalledWith("/");
  });

  it("shows an error when deleting the account fails", async () => {
    deleteAccountCascade.mockRejectedValue(new Error("requires recent login"));
    const user = userEvent.setup();
    render(<ProfileShell />);

    await user.click(screen.getByText("Account verwijderen"));

    expect(await screen.findByText("requires recent login")).toBeInTheDocument();
  });

  it("shows a generic error when deletion fails with a non-Error", async () => {
    deleteAccountCascade.mockRejectedValue("nope");
    const user = userEvent.setup();
    render(<ProfileShell />);

    await user.click(screen.getByText("Account verwijderen"));

    expect(await screen.findByText("Account verwijderen mislukt.")).toBeInTheDocument();
  });

  it("shows a link to the event environment only when a business profile exists", () => {
    const { rerender } = render(<ProfileShell />);
    expect(screen.queryByText("🏢 Naar je eventomgeving")).not.toBeInTheDocument();

    mockUseAuth.mockReturnValue(authState({ currentBusiness: business }));
    rerender(<ProfileShell />);
    expect(screen.getByText("🏢 Naar je eventomgeving")).toBeInTheDocument();
  });

  it("navigates to /bedrijf when the event-environment link is clicked", async () => {
    mockUseAuth.mockReturnValue(authState({ currentBusiness: business }));
    const user = userEvent.setup();
    render(<ProfileShell />);

    await user.click(screen.getByText("🏢 Naar je eventomgeving"));
    expect(routerPush).toHaveBeenCalledWith("/bedrijf");
  });

  it("toggles marketing consent and refreshes the visitor profile", async () => {
    const user = userEvent.setup();
    render(<ProfileShell />);

    const checkbox = screen.getByRole("checkbox", { name: /Houd me per e-mail op de hoogte/ });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(updateMarketingConsent).toHaveBeenCalledWith("u1", true);
    expect(refreshCurrentVisitor).toHaveBeenCalledWith("u1");
  });

  it("shows a toast when toggling consent fails", async () => {
    updateMarketingConsent.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<ProfileShell />);

    await user.click(screen.getByRole("checkbox", { name: /Houd me per e-mail op de hoogte/ }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Wijzigen van toestemming mislukt.", "error"));
  });

  it("changes the password after reauthenticating", async () => {
    const user = userEvent.setup();
    render(<ProfileShell />);

    await user.type(screen.getByLabelText("Huidig wachtwoord"), "oldpass1");
    await user.type(screen.getByLabelText("Nieuw wachtwoord"), "newpass1");
    await user.click(screen.getByText("Wachtwoord wijzigen"));

    expect(changeAccountPassword).toHaveBeenCalledWith({ uid: "u1" }, "oldpass1", "newpass1");
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Wachtwoord gewijzigd.", "success"));
  });

  it("shows a friendly error when the current password is wrong", async () => {
    changeAccountPassword.mockRejectedValue({ code: "auth/wrong-password" });
    const user = userEvent.setup();
    render(<ProfileShell />);

    await user.type(screen.getByLabelText("Huidig wachtwoord"), "wrongpass");
    await user.type(screen.getByLabelText("Nieuw wachtwoord"), "newpass1");
    await user.click(screen.getByText("Wachtwoord wijzigen"));

    expect(await screen.findByText("Huidig wachtwoord is onjuist.")).toBeInTheDocument();
  });

  it("disables the password submit button until both fields are filled", () => {
    render(<ProfileShell />);
    expect(screen.getByText("Wachtwoord wijzigen")).toBeDisabled();
  });
});
