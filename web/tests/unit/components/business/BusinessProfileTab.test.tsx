import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const showToast = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast }),
}));

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

const updateBusinessProfile = vi.fn();
const deleteBusinessProfileCascade = vi.fn();
vi.mock("@/lib/firebase/firestore", () => ({
  updateBusinessProfile: (...a: unknown[]) => updateBusinessProfile(...a),
  deleteBusinessProfileCascade: (...a: unknown[]) => deleteBusinessProfileCascade(...a),
}));

import { BusinessProfileTab } from "@/components/business/BusinessProfileTab";

const business = { uid: "u1", businessName: "My Shop", email: "biz@example.com", createdAt: null as never };
const refreshCurrentBusiness = vi.fn();

function authState(overrides: Record<string, unknown> = {}) {
  return { currentBusiness: business, refreshCurrentBusiness, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue(authState());
  updateBusinessProfile.mockResolvedValue(undefined);
  deleteBusinessProfileCascade.mockResolvedValue(undefined);
  refreshCurrentBusiness.mockResolvedValue(undefined);
});

describe("BusinessProfileTab", () => {
  it("renders nothing when there is no current business", () => {
    mockUseAuth.mockReturnValue(authState({ currentBusiness: null }));
    const { container } = render(<BusinessProfileTab />);
    expect(container).toBeEmptyDOMElement();
  });

  it("pre-fills from the current profile, with email read-only", () => {
    render(<BusinessProfileTab />);
    expect(screen.getByDisplayValue("My Shop")).toBeInTheDocument();
    expect(screen.getByDisplayValue("biz@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeDisabled();
  });

  it("rejects an empty business name without saving", async () => {
    const user = userEvent.setup();
    render(<BusinessProfileTab />);

    await user.clear(screen.getByLabelText("Organisatienaam"));
    await user.click(screen.getByText("Instellingen opslaan"));

    expect(await screen.findByText("Organisatienaam mag niet leeg zijn")).toBeInTheDocument();
    expect(updateBusinessProfile).not.toHaveBeenCalled();
  });

  it("saves the business name and default address, then refreshes the profile", async () => {
    const user = userEvent.setup();
    render(<BusinessProfileTab />);

    await user.clear(screen.getByLabelText("Organisatienaam"));
    await user.type(screen.getByLabelText("Organisatienaam"), "Renamed Shop");
    await user.type(screen.getByLabelText("Standaardadres"), "Heuvelstraat 1");
    await user.click(screen.getByText("Instellingen opslaan"));

    await waitFor(() =>
      expect(updateBusinessProfile).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ businessName: "Renamed Shop", defaultAddress: "Heuvelstraat 1" }),
      ),
    );
    expect(refreshCurrentBusiness).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Instellingen opgeslagen", "success");
  });

  it("shows an error and does not refresh when saving fails", async () => {
    updateBusinessProfile.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<BusinessProfileTab />);

    await user.click(screen.getByText("Instellingen opslaan"));

    expect(await screen.findByText("offline")).toBeInTheDocument();
    expect(refreshCurrentBusiness).not.toHaveBeenCalled();
  });

  it("shows a generic error when saving fails with a non-Error", async () => {
    updateBusinessProfile.mockRejectedValue("nope");
    const user = userEvent.setup();
    render(<BusinessProfileTab />);

    await user.click(screen.getByText("Instellingen opslaan"));

    expect(await screen.findByText("Opslaan mislukt.")).toBeInTheDocument();
  });

  it("extracts lat/lng from a pasted Google Maps URL", async () => {
    const user = userEvent.setup();
    render(<BusinessProfileTab />);

    await user.type(
      screen.getByPlaceholderText("Google Maps URL"),
      "https://www.google.com/maps/@51.5555,5.0913,17z",
    );
    await user.click(screen.getByText("Extract"));
    await user.click(screen.getByText("Instellingen opslaan"));

    await waitFor(() =>
      expect(updateBusinessProfile).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ defaultLat: 51.5555, defaultLng: 5.0913 }),
      ),
    );
  });

  it("shows an error when the Maps URL has no extractable coordinates", async () => {
    const user = userEvent.setup();
    render(<BusinessProfileTab />);

    await user.type(screen.getByPlaceholderText("Google Maps URL"), "not a maps url");
    await user.click(screen.getByText("Extract"));

    expect(await screen.findByText("Coördinaten niet gevonden")).toBeInTheDocument();
    expect(updateBusinessProfile).not.toHaveBeenCalled();
  });

  it("deletes the business profile, refreshes context, and navigates to the map", async () => {
    const user = userEvent.setup();
    render(<BusinessProfileTab />);

    await user.click(screen.getByRole("button", { name: "Event-profiel verwijderen" }));

    await waitFor(() => expect(deleteBusinessProfileCascade).toHaveBeenCalledWith("u1"));
    expect(refreshCurrentBusiness).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Event-profiel verwijderd.", "success");
    expect(routerPush).toHaveBeenCalledWith("/");
  });

  it("shows an error and does not navigate when deleting the business profile fails", async () => {
    deleteBusinessProfileCascade.mockRejectedValue(new Error("requires recent login"));
    const user = userEvent.setup();
    render(<BusinessProfileTab />);

    await user.click(screen.getByRole("button", { name: "Event-profiel verwijderen" }));

    expect(await screen.findByText("requires recent login")).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("shows a generic error when deleting the business profile fails with a non-Error", async () => {
    deleteBusinessProfileCascade.mockRejectedValue("nope");
    const user = userEvent.setup();
    render(<BusinessProfileTab />);

    await user.click(screen.getByRole("button", { name: "Event-profiel verwijderen" }));

    expect(await screen.findByText("Verwijderen mislukt.")).toBeInTheDocument();
  });
});
