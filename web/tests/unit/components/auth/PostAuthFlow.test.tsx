import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const saveOnboardingConsent = vi.fn();
const createBusinessProfile = vi.fn();
vi.mock("@/lib/firebase/firestore", () => ({
  saveOnboardingConsent: (...a: unknown[]) => saveOnboardingConsent(...a),
  createBusinessProfile: (...a: unknown[]) => createBusinessProfile(...a),
}));

import { PostAuthFlow } from "@/components/auth/PostAuthFlow";

const refreshCurrentVisitor = vi.fn();
const refreshCurrentBusiness = vi.fn();

const visitor = { uid: "u1", email: "user@example.com", displayName: "user", createdAt: null as never };
const business = { uid: "u1", businessName: "My Shop", email: "user@example.com", createdAt: null as never };

function authState(overrides: Record<string, unknown> = {}) {
  return {
    currentUser: { uid: "u1", email: "user@example.com", displayName: null },
    currentVisitor: visitor,
    currentBusiness: null,
    refreshCurrentVisitor,
    refreshCurrentBusiness,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue(authState());
  saveOnboardingConsent.mockResolvedValue(undefined);
  createBusinessProfile.mockResolvedValue(business);
  refreshCurrentVisitor.mockResolvedValue(undefined);
  refreshCurrentBusiness.mockResolvedValue(undefined);
});

describe("PostAuthFlow — onboarding", () => {
  it("prefills the name from the Google displayName when present", () => {
    mockUseAuth.mockReturnValue(authState({ currentUser: { uid: "u1", email: "a@b.com", displayName: "Jago" } }));
    render(
      <PostAuthFlow open startStep="onboarding" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );
    expect(screen.getByLabelText("Hoe mogen we je noemen?")).toHaveValue("Jago");
  });

  it("starts with consent unchecked", () => {
    render(
      <PostAuthFlow open startStep="onboarding" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("saves the name and consent, then moves to the chooser without closing", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <PostAuthFlow open startStep="onboarding" onClose={onClose} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );

    await user.clear(screen.getByLabelText("Hoe mogen we je noemen?"));
    await user.type(screen.getByLabelText("Hoe mogen we je noemen?"), "Jago");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByText("Doorgaan"));

    await waitFor(() => expect(saveOnboardingConsent).toHaveBeenCalledWith("u1", "Jago", true));
    expect(refreshCurrentVisitor).toHaveBeenCalledWith("u1");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Waar wil je naartoe?" })).toBeInTheDocument();
  });

  it("falls back to the existing displayName when the name field is left blank", async () => {
    const user = userEvent.setup();
    render(
      <PostAuthFlow open startStep="onboarding" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );

    await user.clear(screen.getByLabelText("Hoe mogen we je noemen?"));
    await user.click(screen.getByText("Doorgaan"));

    await waitFor(() => expect(saveOnboardingConsent).toHaveBeenCalledWith("u1", "user", false));
  });

  it("shows an error and stays on onboarding when saving fails", async () => {
    saveOnboardingConsent.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(
      <PostAuthFlow open startStep="onboarding" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );

    await user.click(screen.getByText("Doorgaan"));

    expect(await screen.findByText("offline")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welkom bij 2happies" })).toBeInTheDocument();
  });

  it("shows a generic error when onboarding save fails with a non-Error", async () => {
    saveOnboardingConsent.mockRejectedValue("nope");
    const user = userEvent.setup();
    render(
      <PostAuthFlow open startStep="onboarding" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );

    await user.click(screen.getByText("Doorgaan"));

    expect(await screen.findByText("Opslaan mislukt.")).toBeInTheDocument();
  });

  it("does nothing on submit when there is no current visitor", async () => {
    mockUseAuth.mockReturnValue(authState({ currentVisitor: null }));
    const user = userEvent.setup();
    render(
      <PostAuthFlow open startStep="onboarding" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );

    await user.click(screen.getByText("Doorgaan"));
    expect(saveOnboardingConsent).not.toHaveBeenCalled();
  });
});

describe("PostAuthFlow — chooser", () => {
  it("closes on 'De kaart'", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PostAuthFlow open startStep="chooser" onClose={onClose} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />);

    await user.click(screen.getByText("🗺️ De kaart"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes and opens the profile on 'Mijn profiel'", async () => {
    const onClose = vi.fn();
    const onOpenProfile = vi.fn();
    const user = userEvent.setup();
    render(
      <PostAuthFlow open startStep="chooser" onClose={onClose} onOpenProfile={onOpenProfile} onGoToBusiness={vi.fn()} />,
    );

    await user.click(screen.getByText("👤 Mijn profiel"));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenProfile).toHaveBeenCalled();
  });

  it("labels the business button 'Event-profiel aanmaken' and goes to createBusiness when there is none", async () => {
    const user = userEvent.setup();
    render(<PostAuthFlow open startStep="chooser" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />);

    expect(screen.getByText("🏢 Event-profiel aanmaken")).toBeInTheDocument();
    await user.click(screen.getByText("🏢 Event-profiel aanmaken"));
    expect(screen.getByRole("heading", { name: "Event-profiel aanmaken" })).toBeInTheDocument();
  });

  it("labels the business button 'Event-profiel' and navigates straight there when one exists", async () => {
    mockUseAuth.mockReturnValue(authState({ currentBusiness: business }));
    const onClose = vi.fn();
    const onGoToBusiness = vi.fn();
    const user = userEvent.setup();
    render(
      <PostAuthFlow open startStep="chooser" onClose={onClose} onOpenProfile={vi.fn()} onGoToBusiness={onGoToBusiness} />,
    );

    await user.click(screen.getByText("🏢 Event-profiel"));
    expect(onClose).toHaveBeenCalled();
    expect(onGoToBusiness).toHaveBeenCalled();
  });
});

describe("PostAuthFlow — createBusiness", () => {
  it("can be reached directly via startStep, for the account menu's shortcut", () => {
    render(
      <PostAuthFlow open startStep="createBusiness" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );
    expect(screen.getByRole("heading", { name: "Event-profiel aanmaken" })).toBeInTheDocument();
  });

  it("rejects an empty business name", async () => {
    const user = userEvent.setup();
    render(
      <PostAuthFlow open startStep="createBusiness" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );

    await user.click(screen.getByText("Aanmaken"));
    expect(screen.getByText("Organisatienaam is verplicht.")).toBeInTheDocument();
    expect(createBusinessProfile).not.toHaveBeenCalled();
  });

  it("creates the business, refreshes context, closes, and navigates", async () => {
    const onClose = vi.fn();
    const onGoToBusiness = vi.fn();
    const user = userEvent.setup();
    render(
      <PostAuthFlow
        open
        startStep="createBusiness"
        onClose={onClose}
        onOpenProfile={vi.fn()}
        onGoToBusiness={onGoToBusiness}
      />,
    );

    await user.type(screen.getByLabelText("Organisatienaam"), "  My Shop  ");
    await user.click(screen.getByText("Aanmaken"));

    await waitFor(() => expect(createBusinessProfile).toHaveBeenCalledWith("u1", "My Shop", "user@example.com"));
    expect(refreshCurrentBusiness).toHaveBeenCalledWith("u1");
    expect(onClose).toHaveBeenCalled();
    expect(onGoToBusiness).toHaveBeenCalled();
  });

  it("shows an error and does not navigate when creation fails", async () => {
    createBusinessProfile.mockRejectedValue(new Error("offline"));
    const onGoToBusiness = vi.fn();
    const user = userEvent.setup();
    render(
      <PostAuthFlow
        open
        startStep="createBusiness"
        onClose={vi.fn()}
        onOpenProfile={vi.fn()}
        onGoToBusiness={onGoToBusiness}
      />,
    );

    await user.type(screen.getByLabelText("Organisatienaam"), "My Shop");
    await user.click(screen.getByText("Aanmaken"));

    expect(await screen.findByText("offline")).toBeInTheDocument();
    expect(onGoToBusiness).not.toHaveBeenCalled();
  });

  it("shows a generic error when creation fails with a non-Error", async () => {
    createBusinessProfile.mockRejectedValue("nope");
    const user = userEvent.setup();
    render(
      <PostAuthFlow open startStep="createBusiness" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Organisatienaam"), "My Shop");
    await user.click(screen.getByText("Aanmaken"));

    expect(await screen.findByText("Aanmaken mislukt.")).toBeInTheDocument();
  });

  it("falls back to an empty email when the current user has none", async () => {
    mockUseAuth.mockReturnValue(authState({ currentUser: { uid: "u1", email: null, displayName: null } }));
    const user = userEvent.setup();
    render(
      <PostAuthFlow open startStep="createBusiness" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Organisatienaam"), "My Shop");
    await user.click(screen.getByText("Aanmaken"));

    await waitFor(() => expect(createBusinessProfile).toHaveBeenCalledWith("u1", "My Shop", ""));
  });

  it("does nothing on submit when there is no current user", async () => {
    mockUseAuth.mockReturnValue(authState({ currentUser: null }));
    const user = userEvent.setup();
    render(
      <PostAuthFlow open startStep="createBusiness" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Organisatienaam"), "My Shop");
    await user.click(screen.getByText("Aanmaken"));
    expect(createBusinessProfile).not.toHaveBeenCalled();
  });

  it("goes back to the chooser", async () => {
    const user = userEvent.setup();
    render(
      <PostAuthFlow open startStep="createBusiness" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );

    await user.click(screen.getByText("Terug"));
    expect(screen.getByRole("heading", { name: "Waar wil je naartoe?" })).toBeInTheDocument();
  });
});

describe("PostAuthFlow re-sync on open", () => {
  it("re-applies startStep and clears fields each time it reopens", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PostAuthFlow open startStep="chooser" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );
    await user.click(screen.getByText("🏢 Event-profiel aanmaken"));
    await user.type(screen.getByLabelText("Organisatienaam"), "Draft Name");

    rerender(
      <PostAuthFlow open={false} startStep="chooser" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );
    rerender(
      <PostAuthFlow open startStep="onboarding" onClose={vi.fn()} onOpenProfile={vi.fn()} onGoToBusiness={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { name: "Welkom bij 2happies" })).toBeInTheDocument();
  });
});
