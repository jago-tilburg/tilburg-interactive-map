import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Shop } from "@/types/shops";
import type { BusinessEvent } from "@/types/events";
import type { Visitor } from "@/types/account";

vi.mock("@/lib/firebase/auth", () => ({
  signOutCurrentUser: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const subscribeVisitorProfile = vi.fn();
vi.mock("@/lib/firebase/firestore", () => ({
  subscribeVisitorProfile: (...a: unknown[]) => subscribeVisitorProfile(...a),
}));

const subscribeShops = vi.fn();
vi.mock("@/lib/firebase/shops", () => ({
  subscribeShops: (...a: unknown[]) => subscribeShops(...a),
}));

const subscribeApprovedBusinessEvents = vi.fn();
vi.mock("@/lib/firebase/businessEvents", () => ({
  subscribeApprovedBusinessEvents: (...a: unknown[]) => subscribeApprovedBusinessEvents(...a),
}));

import { VisitorDashboard } from "@/components/auth/VisitorDashboard";
import { signOutCurrentUser } from "@/lib/firebase/auth";

const visitor: Visitor = {
  uid: "u1",
  email: "visitor@example.com",
  displayName: "visitor",
  createdAt: null as never,
  savedEventIds: ["evt1"],
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

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ currentVisitor: visitor });
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

describe("VisitorDashboard", () => {
  it("renders nothing when there is no current visitor", () => {
    mockUseAuth.mockReturnValue({ currentVisitor: null });
    const { container } = render(<VisitorDashboard open onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the visitor email and signs out on logout", async () => {
    vi.mocked(signOutCurrentUser).mockResolvedValue(undefined as never);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<VisitorDashboard open onClose={onClose} />);

    expect(screen.getByText("visitor@example.com")).toBeInTheDocument();
    await user.click(screen.getByText("Uitloggen"));
    expect(signOutCurrentUser).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows liked shops, ratings given, and saved events for the visitor only", () => {
    render(<VisitorDashboard open onClose={vi.fn()} />);

    expect(screen.getByText("Café Zuid")).toBeInTheDocument();
    expect(screen.queryByText("Unrelated Shop")).not.toBeInTheDocument();
    expect(screen.getByText(/Café Zuid — 7.5 ⭐/)).toBeInTheDocument();
    expect(screen.getByText(/Kermis/)).toBeInTheDocument();
  });

  it("shows empty states when the visitor has no likes, ratings, or saved events", () => {
    mockUseAuth.mockReturnValue({ currentVisitor: { ...visitor, savedEventIds: [] } });
    subscribeVisitorProfile.mockImplementation((_uid: string, onChange: (v: Visitor | null) => void) => {
      onChange({ ...visitor, savedEventIds: [] });
      return vi.fn();
    });
    subscribeShops.mockImplementation((onChange: (s: Shop[]) => void) => {
      onChange([otherShop]);
      return vi.fn();
    });
    render(<VisitorDashboard open onClose={vi.fn()} />);

    expect(screen.getByText("Nog geen shops geliked.")).toBeInTheDocument();
    expect(screen.getByText("Nog geen ratings gegeven.")).toBeInTheDocument();
    expect(screen.getByText("Nog geen evenementen bewaard.")).toBeInTheDocument();
  });

  it("falls back to the cached savedEventIds before the live profile subscription resolves", () => {
    subscribeVisitorProfile.mockImplementation(() => vi.fn());
    render(<VisitorDashboard open onClose={vi.fn()} />);
    expect(screen.getByText(/Kermis/)).toBeInTheDocument();
  });

  it("does not subscribe when closed", () => {
    render(<VisitorDashboard open={false} onClose={vi.fn()} />);
    expect(subscribeShops).not.toHaveBeenCalled();
  });
});
