import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";

vi.mock("@/lib/firebase/auth", () => ({
  subscribeToAuthState: vi.fn(),
  getGoogleRedirectResult: vi.fn().mockResolvedValue(null),
  reloadCurrentUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase/firestore", () => ({
  getVisitorProfile: vi.fn(),
  createVisitorProfile: vi.fn(),
  getBusinessProfile: vi.fn(),
}));

vi.mock("@/lib/firebase/admin", () => ({
  isUidAdmin: vi.fn(),
}));

vi.mock("@/lib/firebase/shops", () => ({
  migrateAnonymousDataToVisitor: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/shops/anonUserId", () => ({
  getAnonUserId: vi.fn(() => "anon-1"),
}));

const showToast = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { subscribeToAuthState, getGoogleRedirectResult, reloadCurrentUser } from "@/lib/firebase/auth";
import { getVisitorProfile, createVisitorProfile, getBusinessProfile } from "@/lib/firebase/firestore";
import { isUidAdmin } from "@/lib/firebase/admin";
import { migrateAnonymousDataToVisitor } from "@/lib/firebase/shops";
import { getAnonUserId } from "@/lib/shops/anonUserId";

type AuthCallback = (user: User | null) => void;

function TestConsumer() {
  const {
    currentUser,
    isAdmin,
    currentVisitor,
    currentBusiness,
    emailVerified,
    refreshEmailVerified,
    refreshCurrentBusiness,
    refreshCurrentVisitor,
    needsOnboarding,
    loading,
    suppressAutoProfileLoadRef,
  } = useAuth();
  const [lastVerifiedResult, setLastVerifiedResult] = useState<string>("unset");
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{currentUser?.uid ?? "none"}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <span data-testid="visitor">{currentVisitor?.displayName ?? "none"}</span>
      <span data-testid="business">{currentBusiness?.businessName ?? "none"}</span>
      <span data-testid="verified">{String(emailVerified)}</span>
      <span data-testid="needs-onboarding">{String(needsOnboarding)}</span>
      <span data-testid="verified-result">{lastVerifiedResult}</span>
      <button onClick={() => { suppressAutoProfileLoadRef.current = true; }}>suppress</button>
      <button onClick={() => refreshCurrentBusiness()}>refresh-business</button>
      <button onClick={() => refreshCurrentBusiness("fresh-uid")}>refresh-business-with-uid</button>
      <button onClick={() => refreshCurrentVisitor()}>refresh-visitor</button>
      <button onClick={() => refreshCurrentVisitor("fresh-uid")}>refresh-visitor-with-uid</button>
      <button onClick={() => refreshEmailVerified().then((v) => setLastVerifiedResult(String(v)))}>
        refresh-verified
      </button>
    </div>
  );
}

function captureAuthCallback(): AuthCallback {
  let captured: AuthCallback = () => {};
  vi.mocked(subscribeToAuthState).mockImplementation((cb) => {
    captured = cb;
    return vi.fn();
  });
  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
  return (user) => captured(user);
}

const fakeUser = { uid: "uid-1", email: "user@example.com", emailVerified: false } as User;

const noVisitor = null;
const noBusiness = null;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGoogleRedirectResult).mockResolvedValue(null as never);
  vi.mocked(getAnonUserId).mockReturnValue("anon-1");
  vi.mocked(migrateAnonymousDataToVisitor).mockResolvedValue(0);
  vi.mocked(getBusinessProfile).mockResolvedValue(noBusiness);
  vi.mocked(getVisitorProfile).mockResolvedValue(noVisitor);
});

describe("AuthProvider dual-role resolution", () => {
  it("loads a visitor profile even for an admin — admin is additive, not exclusive", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(true);
    vi.mocked(getVisitorProfile).mockResolvedValue({
      uid: "uid-1",
      email: "user@example.com",
      displayName: "admin-visitor",
      createdAt: null as never,
    });
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("admin")).toHaveTextContent("true");
    expect(screen.getByTestId("visitor")).toHaveTextContent("admin-visitor");
  });

  it("loads a visitor profile alongside a business profile — one account can be both", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(getBusinessProfile).mockResolvedValue({
      uid: "uid-1",
      businessName: "My Shop",
      email: "user@example.com",
      createdAt: null as never,
    });
    vi.mocked(getVisitorProfile).mockResolvedValue({
      uid: "uid-1",
      email: "user@example.com",
      displayName: "user",
      createdAt: null as never,
    });
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(screen.getByTestId("business")).toHaveTextContent("My Shop"));
    expect(screen.getByTestId("visitor")).toHaveTextContent("user");
  });

  // Regression test for a real bug found via a live pen-test: isUidAdmin()
  // used to read Firestore admins/{uid} directly, a collection that's
  // `allow read, write: if false` for EVERYONE (by design — see admin.ts).
  // That read could never succeed, and the unguarded `await` in this
  // component's auth-state callback meant a rejection there silently broke
  // sign-in resolution for every account type, not just admins.
  it("still resolves a business profile even if isUidAdmin() itself rejects", async () => {
    vi.mocked(isUidAdmin).mockRejectedValue(new Error("permission-denied"));
    vi.mocked(getBusinessProfile).mockResolvedValue({
      uid: "uid-1",
      businessName: "My Shop",
      email: "user@example.com",
      createdAt: null as never,
    });
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(screen.getByTestId("business")).toHaveTextContent("My Shop"));
    expect(screen.getByTestId("admin")).toHaveTextContent("false");
  });

  it("uses an existing visitor profile without creating a new one", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(getVisitorProfile).mockResolvedValue({
      uid: "uid-1",
      email: "user@example.com",
      displayName: "user",
      createdAt: null as never,
    });
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(screen.getByTestId("visitor")).toHaveTextContent("user"));
    expect(createVisitorProfile).not.toHaveBeenCalled();
  });

  it("creates a visitor profile on first sign-in when none exists yet", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(createVisitorProfile).mockResolvedValue({
      uid: "uid-1",
      email: "user@example.com",
      displayName: "user",
      createdAt: null as never,
    });
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(createVisitorProfile).toHaveBeenCalledWith("uid-1", "user@example.com"));
    expect(screen.getByTestId("visitor")).toHaveTextContent("user");
  });

  it("creates a visitor profile with an empty email when the Auth user has none (e.g. phone auth)", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(createVisitorProfile).mockResolvedValue({
      uid: "uid-2",
      email: "",
      displayName: "Bezoeker",
      createdAt: null as never,
    });
    const fire = captureAuthCallback();
    fire({ uid: "uid-2", email: null, emailVerified: false } as User);

    await waitFor(() => expect(createVisitorProfile).toHaveBeenCalledWith("uid-2", ""));
  });

  it("resets all account state on sign-out", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(true);
    const fire = captureAuthCallback();
    fire(fakeUser);
    await waitFor(() => expect(screen.getByTestId("admin")).toHaveTextContent("true"));

    fire(null);
    await waitFor(() => expect(screen.getByTestId("admin")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("visitor")).toHaveTextContent("none");
    expect(screen.getByTestId("business")).toHaveTextContent("none");
  });

  it("migrates anonymous shop data to the visitor uid and toasts when items were migrated", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(getVisitorProfile).mockResolvedValue({
      uid: "uid-1",
      email: "user@example.com",
      displayName: "user",
      createdAt: null as never,
    });
    vi.mocked(migrateAnonymousDataToVisitor).mockResolvedValue(2);
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(migrateAnonymousDataToVisitor).toHaveBeenCalledWith("anon-1", "uid-1"));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith("2 eerdere like(s)/beoordeling(en) gekoppeld aan je account.", "info"),
    );
  });

  it("does not toast when the migration finds nothing to migrate", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(getVisitorProfile).mockResolvedValue({
      uid: "uid-1",
      email: "user@example.com",
      displayName: "user",
      createdAt: null as never,
    });
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(screen.getByTestId("visitor")).toHaveTextContent("user"));
    expect(showToast).not.toHaveBeenCalled();
  });

  it("logs and does not block sign-in when migration fails", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(getVisitorProfile).mockResolvedValue({
      uid: "uid-1",
      email: "user@example.com",
      displayName: "user",
      createdAt: null as never,
    });
    vi.mocked(migrateAnonymousDataToVisitor).mockRejectedValue(new Error("rtdb down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(screen.getByTestId("visitor")).toHaveTextContent("user"));
    expect(consoleError).toHaveBeenCalledWith("Anonymous data migration error:", expect.any(Error));
    consoleError.mockRestore();
  });

  it("attempts migration for an admin too, since admin now also gets a visitor profile", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(true);
    vi.mocked(getVisitorProfile).mockResolvedValue({
      uid: "uid-1",
      email: "user@example.com",
      displayName: "user",
      createdAt: null as never,
    });
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(screen.getByTestId("admin")).toHaveTextContent("true"));
    expect(migrateAnonymousDataToVisitor).toHaveBeenCalledWith("anon-1", "uid-1");
  });

  it("skips the profile-resolution read while suppressAutoProfileLoadRef is set", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    const user = userEvent.setup();
    const fire = captureAuthCallback();

    await user.click(screen.getByText("suppress"));
    fire(fakeUser);

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(getBusinessProfile).not.toHaveBeenCalled();
    expect(getVisitorProfile).not.toHaveBeenCalled();
  });
});

describe("emailVerified", () => {
  it("mirrors the signed-in user's emailVerified flag", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    const fire = captureAuthCallback();
    fire({ ...fakeUser, emailVerified: true });

    await waitFor(() => expect(screen.getByTestId("verified")).toHaveTextContent("true"));
  });

  it("refreshEmailVerified reloads the user and updates state", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    const user = userEvent.setup();
    let verifiedNow = false;
    const liveUser = {
      ...fakeUser,
      get emailVerified() {
        return verifiedNow;
      },
    };
    vi.mocked(reloadCurrentUser).mockImplementation(async () => {
      verifiedNow = true;
    });
    const fire = captureAuthCallback();
    fire(liveUser as never);
    await waitFor(() => expect(screen.getByTestId("verified")).toHaveTextContent("false"));

    await user.click(screen.getByText("refresh-verified"));
    await waitFor(() => expect(screen.getByTestId("verified")).toHaveTextContent("true"));
    expect(reloadCurrentUser).toHaveBeenCalledWith(liveUser);
    expect(screen.getByTestId("verified-result")).toHaveTextContent("true");
  });

  it("refreshEmailVerified does nothing and resolves false when signed out", async () => {
    const user = userEvent.setup();
    captureAuthCallback();
    await user.click(screen.getByText("refresh-verified"));
    expect(reloadCurrentUser).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("verified-result")).toHaveTextContent("false"));
  });
});

describe("needsOnboarding", () => {
  it("is true once a visitor profile exists without a marketingConsentAt", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(getVisitorProfile).mockResolvedValue({
      uid: "uid-1",
      email: "user@example.com",
      displayName: "user",
      createdAt: null as never,
    });
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(screen.getByTestId("needs-onboarding")).toHaveTextContent("true"));
  });

  it("is false once marketingConsentAt is set, even if consent itself is false", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(getVisitorProfile).mockResolvedValue({
      uid: "uid-1",
      email: "user@example.com",
      displayName: "user",
      createdAt: null as never,
      marketingConsent: false,
      marketingConsentAt: {} as never,
    });
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(screen.getByTestId("visitor")).toHaveTextContent("user"));
    expect(screen.getByTestId("needs-onboarding")).toHaveTextContent("false");
  });

  it("is false while signed out", () => {
    captureAuthCallback();
    expect(screen.getByTestId("needs-onboarding")).toHaveTextContent("false");
  });
});

describe("Google redirect result", () => {
  it("checks for a pending redirect result on mount", async () => {
    captureAuthCallback();
    await waitFor(() => expect(getGoogleRedirectResult).toHaveBeenCalled());
  });

  it("toasts an error when the redirect sign-in failed", async () => {
    vi.mocked(getGoogleRedirectResult).mockRejectedValue({ code: "auth/account-exists-with-different-credential" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    captureAuthCallback();

    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Inloggen met Google is mislukt.", "error"));
    consoleError.mockRestore();
  });
});

describe("refreshCurrentBusiness", () => {
  it("re-fetches the signed-in business's profile and updates state", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(getBusinessProfile).mockResolvedValue({
      uid: "uid-1",
      businessName: "My Shop",
      email: "user@example.com",
      createdAt: null as never,
    });
    const user = userEvent.setup();
    const fire = captureAuthCallback();
    fire(fakeUser);
    await waitFor(() => expect(screen.getByTestId("business")).toHaveTextContent("My Shop"));

    vi.mocked(getBusinessProfile).mockResolvedValue({
      uid: "uid-1",
      businessName: "Renamed Shop",
      email: "user@example.com",
      createdAt: null as never,
    });
    await user.click(screen.getByText("refresh-business"));

    await waitFor(() => expect(screen.getByTestId("business")).toHaveTextContent("Renamed Shop"));
    expect(getBusinessProfile).toHaveBeenLastCalledWith("uid-1");
  });

  it("does nothing when there is no signed-in user and no uid argument is given", async () => {
    const user = userEvent.setup();
    captureAuthCallback();
    await user.click(screen.getByText("refresh-business"));
    expect(getBusinessProfile).not.toHaveBeenCalled();
  });

  // Regression test for a real bug found live via a pen-test: right after
  // registration, currentUser in this context may not have propagated from
  // the auth-state listener yet (an async React state update racing the
  // caller) — passing the uid explicitly must work regardless.
  it("works with an explicit uid even when currentUser hasn't propagated yet", async () => {
    vi.mocked(getBusinessProfile).mockResolvedValue({
      uid: "fresh-uid",
      businessName: "Brand New Business",
      email: "new@example.com",
      createdAt: null as never,
    });
    const user = userEvent.setup();
    captureAuthCallback(); // no fire() — simulates currentUser still null
    await user.click(screen.getByText("refresh-business-with-uid"));
    await waitFor(() => expect(screen.getByTestId("business")).toHaveTextContent("Brand New Business"));
    expect(getBusinessProfile).toHaveBeenCalledWith("fresh-uid");
  });
});

describe("refreshCurrentVisitor", () => {
  it("re-fetches the signed-in visitor's profile and updates state", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(getVisitorProfile).mockResolvedValue({
      uid: "uid-1",
      email: "user@example.com",
      displayName: "user",
      createdAt: null as never,
    });
    const user = userEvent.setup();
    const fire = captureAuthCallback();
    fire(fakeUser);
    await waitFor(() => expect(screen.getByTestId("visitor")).toHaveTextContent("user"));

    vi.mocked(getVisitorProfile).mockResolvedValue({
      uid: "uid-1",
      email: "user@example.com",
      displayName: "renamed",
      createdAt: null as never,
    });
    await user.click(screen.getByText("refresh-visitor"));

    await waitFor(() => expect(screen.getByTestId("visitor")).toHaveTextContent("renamed"));
    expect(getVisitorProfile).toHaveBeenLastCalledWith("uid-1");
  });

  it("does nothing when there is no signed-in user and no uid argument is given", async () => {
    const user = userEvent.setup();
    captureAuthCallback();
    await user.click(screen.getByText("refresh-visitor"));
    expect(getVisitorProfile).not.toHaveBeenCalled();
  });

  it("works with an explicit uid even when currentUser hasn't propagated yet", async () => {
    vi.mocked(getVisitorProfile).mockResolvedValue({
      uid: "fresh-uid",
      email: "new@example.com",
      displayName: "Fresh",
      createdAt: null as never,
    });
    const user = userEvent.setup();
    captureAuthCallback();
    await user.click(screen.getByText("refresh-visitor-with-uid"));
    await waitFor(() => expect(screen.getByTestId("visitor")).toHaveTextContent("Fresh"));
    expect(getVisitorProfile).toHaveBeenCalledWith("fresh-uid");
  });
});

describe("useAuth outside a provider", () => {
  it("throws when called without an enclosing AuthProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow("useAuth must be used within AuthProvider");
    consoleError.mockRestore();
  });
});
