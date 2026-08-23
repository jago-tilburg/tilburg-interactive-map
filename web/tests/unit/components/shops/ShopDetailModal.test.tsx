import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Shop } from "@/types/shops";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/shops/anonUserId", () => ({
  getAnonUserId: vi.fn(() => "anon-1"),
}));

const setShopLikes = vi.fn();
const setShopUserRatings = vi.fn();
const setShopComments = vi.fn();
const setShopUserReviews = vi.fn();
const trackShopView = vi.fn();
const getShopViews = vi.fn();
const deleteShop = vi.fn();
vi.mock("@/lib/firebase/shops", () => ({
  setShopLikes: (...a: unknown[]) => setShopLikes(...a),
  setShopUserRatings: (...a: unknown[]) => setShopUserRatings(...a),
  setShopComments: (...a: unknown[]) => setShopComments(...a),
  setShopUserReviews: (...a: unknown[]) => setShopUserReviews(...a),
  trackShopView: (...a: unknown[]) => trackShopView(...a),
  getShopViews: (...a: unknown[]) => getShopViews(...a),
  deleteShop: (...a: unknown[]) => deleteShop(...a),
}));

const navigateToLocation = vi.fn();
vi.mock("@/lib/shops/navigateToLocation", () => ({
  navigateToLocation: (...a: unknown[]) => navigateToLocation(...a),
}));

import { ShopDetailModal } from "@/components/shops/ShopDetailModal";

function makeShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 9001,
    name: "Test Shop",
    address: "Heuvelplein 1",
    lat: 51.5,
    lng: 5.09,
    rating: 8,
    price: "€€",
    photoUrl: "",
    review: "Lekker eten",
    tiktokUrl: "",
    instagramUrl: "",
    dietaryOptions: { glutenvrij: false, halal: false, vega: false },
    createdAt: "2026-01-01",
    likes: [],
    comments: [],
    userReviews: [],
    userRatings: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: false });
  trackShopView.mockResolvedValue(1);
  getShopViews.mockResolvedValue(5);
  setShopLikes.mockResolvedValue(undefined);
  setShopUserRatings.mockResolvedValue(undefined);
  setShopComments.mockResolvedValue(undefined);
  setShopUserReviews.mockResolvedValue(undefined);
  deleteShop.mockResolvedValue(undefined);
});

describe("ShopDetailModal", () => {
  it("renders nothing when shop is null", () => {
    const { container } = render(<ShopDetailModal open onClose={vi.fn()} shop={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows shop details and the view count", async () => {
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    expect(screen.getByRole("dialog", { name: "Test Shop" })).toBeInTheDocument();
    expect(screen.getByText(/Heuvelplein 1/)).toBeInTheDocument();
    expect(screen.getByText("8 ⭐")).toBeInTheDocument();
    expect(trackShopView).toHaveBeenCalledWith(9001);
    expect(await screen.findByText("👁️ 5")).toBeInTheDocument();
  });

  it("navigates when the address is clicked", async () => {
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await user.click(screen.getByText(/Heuvelplein 1/));
    expect(navigateToLocation).toHaveBeenCalledWith(51.5, 5.09, "Test Shop");
  });

  it("shows the average rating badge once there are user ratings", () => {
    const shop = makeShop({ userRatings: [{ userId: "u1", rating: 8, createdAt: 1 }, { userId: "u2", rating: 10, createdAt: 2 }] });
    render(<ShopDetailModal open onClose={vi.fn()} shop={shop} />);
    expect(screen.getByText("👥 9 ⭐ (2)")).toBeInTheDocument();
  });

  it("submits a rating using the anonymous user id once resolved", async () => {
    const shop = makeShop();
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={shop} />);

    await waitFor(() => expect(screen.getByLabelText("Geef 7 sterren")).toBeInTheDocument());
    await user.click(screen.getByLabelText("Geef 7 sterren"));

    expect(setShopUserRatings).toHaveBeenCalledWith(
      9001,
      expect.arrayContaining([expect.objectContaining({ userId: "anon-1", rating: 7 })]),
    );
  });

  it("shows a save error when rating fails", async () => {
    setShopUserRatings.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await waitFor(() => expect(screen.getByLabelText("Geef 5 sterren")).toBeInTheDocument());
    await user.click(screen.getByLabelText("Geef 5 sterren"));

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic rating error when a non-Error is thrown", async () => {
    setShopUserRatings.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await waitFor(() => expect(screen.getByLabelText("Geef 5 sterren")).toBeInTheDocument());
    await user.click(screen.getByLabelText("Geef 5 sterren"));

    expect(await screen.findByText("Rating opslaan mislukt.")).toBeInTheDocument();
  });

  it("swallows a trackShopView failure without surfacing an error", async () => {
    trackShopView.mockRejectedValue(new Error("boom"));
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await waitFor(() => expect(trackShopView).toHaveBeenCalledWith(9001));
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });

  it("shows an error when fetching the view count fails", async () => {
    getShopViews.mockRejectedValue(new Error("boom"));
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await waitFor(() => expect(getShopViews).toHaveBeenCalled());
    expect(screen.queryByText(/👁️/)).not.toBeInTheDocument();
  });

  it("toggles a like", async () => {
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await waitFor(() => expect(screen.getByText("👍 0")).toBeInTheDocument());
    await user.click(screen.getByText("👍 0"));

    expect(setShopLikes).toHaveBeenCalledWith(9001, ["anon-1"]);
  });

  it("requires non-empty comment text before opening the name prompt", async () => {
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await user.click(screen.getByText("Plaats reactie"));
    expect(screen.getByText("Vul een reactie in")).toBeInTheDocument();
  });

  it("posts a comment through the name-prompt flow", async () => {
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await user.type(screen.getByLabelText("Reactie"), "Heerlijk!");
    await user.click(screen.getByText("Plaats reactie"));
    expect(screen.getByRole("dialog", { name: "Wat is je naam?" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Jouw naam"), "Jago");
    await user.click(screen.getByText("Versturen"));

    await waitFor(() =>
      expect(setShopComments).toHaveBeenCalledWith(
        9001,
        expect.arrayContaining([expect.objectContaining({ userName: "Jago", text: "Heerlijk!" })]),
      ),
    );
  });

  it("cancels the comment name prompt without posting", async () => {
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await user.type(screen.getByLabelText("Reactie"), "Heerlijk!");
    await user.click(screen.getByText("Plaats reactie"));
    await user.click(screen.getByText("Annuleren"));

    expect(screen.queryByRole("dialog", { name: "Wat is je naam?" })).not.toBeInTheDocument();
    expect(setShopComments).not.toHaveBeenCalled();
  });

  it("closes the review modal via cancel without posting", async () => {
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await user.click(screen.getByText("Voeg Je Review Toe"));
    await user.click(screen.getByText("Annuleren"));

    expect(screen.queryByRole("dialog", { name: "Voeg Je Review Toe" })).not.toBeInTheDocument();
    expect(setShopUserReviews).not.toHaveBeenCalled();
  });

  it("lists existing comments and reviews", () => {
    const shop = makeShop({
      comments: [{ id: 1, userId: "u1", userName: "Anna", text: "Top!", createdAt: "t" }],
      userReviews: [{ id: 2, userId: "u2", userName: "Bram", rating: 9.0, text: "Geweldig", createdAt: "t" }],
    });
    render(<ShopDetailModal open onClose={vi.fn()} shop={shop} />);

    expect(screen.getByText("Top!")).toBeInTheDocument();
    expect(screen.getByText("Geweldig")).toBeInTheDocument();
  });

  it("opens the review modal and submits a review", async () => {
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await user.click(screen.getByText("Voeg Je Review Toe"));
    await user.type(screen.getByLabelText("Jouw naam"), "Jago");
    await user.selectOptions(screen.getByLabelText("Beoordeling"), "9.0");
    await user.type(screen.getByLabelText("Je review"), "Top");
    await user.click(screen.getByText("Versturen"));

    await waitFor(() =>
      expect(setShopUserReviews).toHaveBeenCalledWith(
        9001,
        expect.arrayContaining([expect.objectContaining({ userName: "Jago", rating: 9.0, text: "Top" })]),
      ),
    );
  });

  it("does not show admin actions or delete buttons for a non-admin, non-author visitor", () => {
    const shop = makeShop({
      comments: [{ id: 1, userId: "someone-else", userName: "Anna", text: "Top!", createdAt: "t" }],
    });
    render(<ShopDetailModal open onClose={vi.fn()} shop={shop} />);

    expect(screen.queryByText("✏️ Bewerken")).not.toBeInTheDocument();
    expect(screen.queryByText("Verwijderen")).not.toBeInTheDocument();
  });

  it("shows admin actions and lets the admin edit/delete the shop", async () => {
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    const onClose = vi.fn();
    const onEditRequested = vi.fn();
    const shop = makeShop();
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={onClose} shop={shop} onEditRequested={onEditRequested} />);

    await user.click(screen.getByText("✏️ Bewerken"));
    expect(onEditRequested).toHaveBeenCalledWith(shop);

    await user.click(screen.getByText("🗑️ Verwijderen"));
    await waitFor(() => expect(deleteShop).toHaveBeenCalledWith(9001));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a delete error for the shop when deletion fails", async () => {
    deleteShop.mockRejectedValue(new Error("network down"));
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await user.click(screen.getByText("🗑️ Verwijderen"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic delete error for the shop when a non-Error is thrown", async () => {
    deleteShop.mockRejectedValue("not an Error instance");
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await user.click(screen.getByText("🗑️ Verwijderen"));
    expect(await screen.findByText("Verwijderen mislukt.")).toBeInTheDocument();
  });

  it("shows the photo when photoUrl is set", () => {
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop({ photoUrl: "https://example.com/p.jpg" })} />);
    expect(screen.getByAltText("Test Shop")).toHaveAttribute("src", "https://example.com/p.jpg");
  });

  it("lets an admin delete another user's comment and review", async () => {
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    const shop = makeShop({
      comments: [{ id: 1, userId: "someone-else", userName: "Anna", text: "Top!", createdAt: "t" }],
      userReviews: [{ id: 2, userId: "someone-else", userName: "Bram", rating: 9.0, text: "Geweldig", createdAt: "t" }],
    });
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={shop} />);

    const deleteButtons = screen.getAllByText("Verwijderen");
    await user.click(deleteButtons[0]);
    expect(setShopComments).toHaveBeenCalledWith(9001, []);

    await user.click(screen.getAllByText("Verwijderen")[deleteButtons.length - 1]);
    expect(setShopUserReviews).toHaveBeenCalledWith(9001, []);
  });

  it("shows an error when deleting a comment fails", async () => {
    setShopComments.mockRejectedValue(new Error("network down"));
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    const shop = makeShop({
      comments: [{ id: 1, userId: "someone-else", userName: "Anna", text: "Top!", createdAt: "t" }],
    });
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={shop} />);

    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic error when deleting a comment fails with a non-Error", async () => {
    setShopComments.mockRejectedValue("not an Error instance");
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    const shop = makeShop({
      comments: [{ id: 1, userId: "someone-else", userName: "Anna", text: "Top!", createdAt: "t" }],
    });
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={shop} />);

    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("Verwijderen mislukt.")).toBeInTheDocument();
  });

  it("shows an error when deleting a review fails", async () => {
    setShopUserReviews.mockRejectedValue(new Error("network down"));
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    const shop = makeShop({
      userReviews: [{ id: 2, userId: "someone-else", userName: "Bram", rating: 9.0, text: "Geweldig", createdAt: "t" }],
    });
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={shop} />);

    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic error when deleting a review fails with a non-Error", async () => {
    setShopUserReviews.mockRejectedValue("not an Error instance");
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    const shop = makeShop({
      userReviews: [{ id: 2, userId: "someone-else", userName: "Bram", rating: 9.0, text: "Geweldig", createdAt: "t" }],
    });
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={shop} />);

    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("Verwijderen mislukt.")).toBeInTheDocument();
  });

  it("shows an error when posting a comment fails", async () => {
    setShopComments.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await user.type(screen.getByLabelText("Reactie"), "Heerlijk!");
    await user.click(screen.getByText("Plaats reactie"));
    await user.type(screen.getByLabelText("Jouw naam"), "Jago");
    await user.click(screen.getByText("Versturen"));

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic error when posting a comment fails with a non-Error", async () => {
    setShopComments.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await user.type(screen.getByLabelText("Reactie"), "Heerlijk!");
    await user.click(screen.getByText("Plaats reactie"));
    await user.type(screen.getByLabelText("Jouw naam"), "Jago");
    await user.click(screen.getByText("Versturen"));

    expect(await screen.findByText("Opslaan mislukt.")).toBeInTheDocument();
  });

  it("shows an error when posting a review fails", async () => {
    setShopUserReviews.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await user.click(screen.getByText("Voeg Je Review Toe"));
    await user.type(screen.getByLabelText("Jouw naam"), "Jago");
    await user.selectOptions(screen.getByLabelText("Beoordeling"), "9.0");
    await user.type(screen.getByLabelText("Je review"), "Top");
    await user.click(screen.getByText("Versturen"));

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic error when posting a review fails with a non-Error", async () => {
    setShopUserReviews.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await user.click(screen.getByText("Voeg Je Review Toe"));
    await user.type(screen.getByLabelText("Jouw naam"), "Jago");
    await user.selectOptions(screen.getByLabelText("Beoordeling"), "9.0");
    await user.type(screen.getByLabelText("Je review"), "Top");
    await user.click(screen.getByText("Versturen"));

    expect(await screen.findByText("Opslaan mislukt.")).toBeInTheDocument();
  });

  it("shows an error when toggling a like fails", async () => {
    setShopLikes.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await waitFor(() => expect(screen.getByText("👍 0")).toBeInTheDocument());
    await user.click(screen.getByText("👍 0"));

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic like error when a non-Error is thrown", async () => {
    setShopLikes.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={makeShop()} />);

    await waitFor(() => expect(screen.getByText("👍 0")).toBeInTheDocument());
    await user.click(screen.getByText("👍 0"));

    expect(await screen.findByText("Opslaan mislukt.")).toBeInTheDocument();
  });

  it("shows the liked state and lets the signed-in visitor un-like", async () => {
    mockUseAuth.mockReturnValue({ currentVisitor: { uid: "visitor-1" }, isAdmin: false });
    const shop = makeShop({ likes: ["visitor-1"] });
    const user = userEvent.setup();
    render(<ShopDetailModal open onClose={vi.fn()} shop={shop} />);

    await user.click(screen.getByText("👍 1"));
    expect(setShopLikes).toHaveBeenCalledWith(9001, []);
  });
});
