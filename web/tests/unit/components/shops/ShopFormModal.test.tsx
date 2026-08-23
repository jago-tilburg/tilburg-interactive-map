import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Shop } from "@/types/shops";

const createShop = vi.fn();
const updateShop = vi.fn();
vi.mock("@/lib/firebase/shops", () => ({
  createShop: (...a: unknown[]) => createShop(...a),
  updateShop: (...a: unknown[]) => updateShop(...a),
}));

import { ShopFormModal } from "@/components/shops/ShopFormModal";

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
    dietaryOptions: { glutenvrij: false, halal: true, vega: false },
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
  createShop.mockResolvedValue(undefined);
  updateShop.mockResolvedValue(undefined);
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Naam Zaak"), "New Shop");
  await user.type(screen.getByLabelText("Adres"), "Some Address 1");
  await user.type(screen.getByLabelText("Je review"), "Erg lekker");
}

describe("ShopFormModal create mode", () => {
  it("validates required fields", async () => {
    const user = userEvent.setup();
    render(<ShopFormModal open onClose={vi.fn()} editingShop={null} />);

    await user.click(screen.getByText("Opslaan"));
    expect(screen.getByText("Vul alle verplichte velden in")).toBeInTheDocument();
    expect(createShop).not.toHaveBeenCalled();
  });

  it("creates a shop with default lat/lng/rating/price and closes on success", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ShopFormModal open onClose={onClose} editingShop={null} />);

    await fillRequiredFields(user);
    await user.click(screen.getByText("Opslaan"));

    expect(createShop).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Shop",
        address: "Some Address 1",
        review: "Erg lekker",
        lat: 51.5555,
        lng: 5.0913,
        rating: 8,
        price: "€€",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("extracts lat/lng from a Google Maps URL", async () => {
    const user = userEvent.setup();
    render(<ShopFormModal open onClose={vi.fn()} editingShop={null} />);

    await user.type(screen.getByLabelText("Google Maps URL"), "https://maps.google.com/@51.6,5.1,15z");
    await user.click(screen.getByText("Extract"));

    expect(screen.getByLabelText("Breedtegraad")).toHaveValue(51.6);
    expect(screen.getByLabelText("Lengtegraad")).toHaveValue(5.1);
  });

  it("shows an error when the Maps URL has no extractable coordinates", async () => {
    const user = userEvent.setup();
    render(<ShopFormModal open onClose={vi.fn()} editingShop={null} />);

    await user.type(screen.getByLabelText("Google Maps URL"), "https://example.com/not-a-maps-link");
    await user.click(screen.getByText("Extract"));

    expect(screen.getByText("Coördinaten niet gevonden")).toBeInTheDocument();
  });

  it("includes checked dietary options and social/photo URLs", async () => {
    const user = userEvent.setup();
    render(<ShopFormModal open onClose={vi.fn()} editingShop={null} />);

    await fillRequiredFields(user);
    await user.click(screen.getByLabelText(/Vega/));
    await user.type(screen.getByLabelText("TikTok URL"), "https://tiktok.com/@test");
    await user.click(screen.getByText("Opslaan"));

    expect(createShop).toHaveBeenCalledWith(
      expect.objectContaining({
        dietaryOptions: { glutenvrij: false, halal: false, vega: true },
        tiktokUrl: "https://tiktok.com/@test",
      }),
    );
  });

  it("includes manually edited lat/lng/rating/price/instagram/photo and all dietary checkboxes", async () => {
    const user = userEvent.setup();
    render(<ShopFormModal open onClose={vi.fn()} editingShop={null} />);

    await fillRequiredFields(user);
    const latInput = screen.getByLabelText("Breedtegraad");
    await user.clear(latInput);
    await user.type(latInput, "51.6");
    const lngInput = screen.getByLabelText("Lengtegraad");
    await user.clear(lngInput);
    await user.type(lngInput, "5.1");
    await user.selectOptions(screen.getByLabelText("Beoordeling"), "9.5");
    await user.selectOptions(screen.getByLabelText("Prijs"), "€€€");
    await user.type(screen.getByLabelText("Instagram URL"), "https://instagram.com/test");
    await user.type(screen.getByLabelText("Foto URL"), "https://example.com/photo.jpg");
    await user.click(screen.getByLabelText(/Glutenvrij/));
    await user.click(screen.getByLabelText(/Halal/));
    await user.click(screen.getByText("Opslaan"));

    expect(createShop).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: 51.6,
        lng: 5.1,
        rating: 9.5,
        price: "€€€",
        instagramUrl: "https://instagram.com/test",
        photoUrl: "https://example.com/photo.jpg",
        dietaryOptions: { glutenvrij: true, halal: true, vega: false },
      }),
    );
  });

  it("shows a save-failure error", async () => {
    createShop.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<ShopFormModal open onClose={vi.fn()} editingShop={null} />);

    await fillRequiredFields(user);
    await user.click(screen.getByText("Opslaan"));

    expect(await screen.findByText("Opslaan mislukt: network down")).toBeInTheDocument();
  });

  it("shows a generic error when a non-Error is thrown", async () => {
    createShop.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<ShopFormModal open onClose={vi.fn()} editingShop={null} />);

    await fillRequiredFields(user);
    await user.click(screen.getByText("Opslaan"));

    expect(await screen.findByText("Opslaan mislukt.")).toBeInTheDocument();
  });

  it("calls onClose when cancelled", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ShopFormModal open onClose={onClose} editingShop={null} />);

    await user.click(screen.getByText("Annuleren"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("ShopFormModal edit mode", () => {
  it("pre-fills the form from the editing shop, including dietary checkboxes", () => {
    render(<ShopFormModal open onClose={vi.fn()} editingShop={makeShop()} />);

    expect(screen.getByDisplayValue("Test Shop")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Bewerken Review" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Halal/)).toBeChecked();
    expect(screen.getByLabelText(/Glutenvrij/)).not.toBeChecked();
  });

  it("updates the shop on save", async () => {
    const shop = makeShop();
    const user = userEvent.setup();
    render(<ShopFormModal open onClose={vi.fn()} editingShop={shop} />);

    const nameInput = screen.getByLabelText("Naam Zaak");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Name");
    await user.click(screen.getByText("Opslaan"));

    expect(updateShop).toHaveBeenCalledWith(9001, expect.objectContaining({ name: "Updated Name" }));
  });

  it("re-syncs the form when reopened for a different shop while still mounted", () => {
    const shopA = makeShop();
    const shopB = makeShop({ id: 9002, name: "Second Shop" });
    const { rerender } = render(<ShopFormModal open onClose={vi.fn()} editingShop={shopA} />);
    expect(screen.getByDisplayValue("Test Shop")).toBeInTheDocument();

    rerender(<ShopFormModal open onClose={vi.fn()} editingShop={shopB} />);
    expect(screen.getByDisplayValue("Second Shop")).toBeInTheDocument();
  });
});
