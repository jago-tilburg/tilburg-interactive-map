import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";

vi.mock("@/lib/firebase/auth", () => ({
  subscribeToAuthState: vi.fn(),
  isVisitorMagicLink: vi.fn(() => false),
  completeVisitorMagicLink: vi.fn(),
  VISITOR_AUTH_EMAIL_KEY: "tilburg-visitor-pending-email",
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
import {
  subscribeToAuthState,
  isVisitorMagicLink,
  completeVisitorMagicLink,
  VISITOR_AUTH_EMAIL_KEY,
} from "@/lib/firebase/auth";
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
    refreshCurrentBusiness,
    loading,
    suppressAutoProfileLoadRef,
  } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{currentUser?.uid ?? "none"}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <span data-testid="visitor">{currentVisitor?.displayName ?? "none"}</span>
      <span data-testid="business">{currentBusiness?.businessName ?? "none"}</span>
      <button onClick={() => { suppressAutoProfileLoadRef.current = true; }}>suppress</button>
      <button onClick={() => refreshCurrentBusiness()}>refresh-business</button>
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

const fakeUser = { uid: "uid-1", email: "user@example.com" } as User;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isVisitorMagicLink).mockReturnValue(false);
  vi.mocked(getAnonUserId).mockReturnValue("anon-1");
  vi.mocked(migrateAnonymousDataToVisitor).mockResolvedValue(0);
  window.localStorage.clear();
});

describe("AuthProvider account-type resolution priority", () => {
  it("resolves admin first when admins/{uid} exists", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(true);
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("admin")).toHaveTextContent("true");
    expect(screen.getByTestId("business")).toHaveTextContent("none");
    expect(screen.getByTestId("visitor")).toHaveTextContent("none");
    expect(getBusinessProfile).not.toHaveBeenCalled();
    expect(getVisitorProfile).not.toHaveBeenCalled();
  });

  it("falls back to business when not admin but a businesses/{uid} doc exists", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
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
    expect(getVisitorProfile).not.toHaveBeenCalled();
  });

  it("falls back to an existing visitor profile when neither admin nor business", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(getBusinessProfile).mockResolvedValue(null);
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
    vi.mocked(getBusinessProfile).mockResolvedValue(null);
    vi.mocked(getVisitorProfile).mockResolvedValue(null);
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
    vi.mocked(getBusinessProfile).mockResolvedValue(null);
    vi.mocked(getVisitorProfile).mockResolvedValue(null);
    vi.mocked(createVisitorProfile).mockResolvedValue({
      uid: "uid-2",
      email: "",
      displayName: "Bezoeker",
      createdAt: null as never,
    });
    const fire = captureAuthCallback();
    fire({ uid: "uid-2", email: null } as User);

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
  });

  it("migrates anonymous shop data to the visitor uid and toasts when items were migrated", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(false);
    vi.mocked(getBusinessProfile).mockResolvedValue(null);
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
    vi.mocked(getBusinessProfile).mockResolvedValue(null);
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
    vi.mocked(getBusinessProfile).mockResolvedValue(null);
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

  it("does not attempt migration for admins or businesses", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(true);
    const fire = captureAuthCallback();
    fire(fakeUser);

    await waitFor(() => expect(screen.getByTestId("admin")).toHaveTextContent("true"));
    expect(migrateAnonymousDataToVisitor).not.toHaveBeenCalled();
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

  it("does nothing when there is no signed-in user", async () => {
    const user = userEvent.setup();
    captureAuthCallback();
    await user.click(screen.getByText("refresh-business"));
    expect(getBusinessProfile).not.toHaveBeenCalled();
  });
});

describe("magic-link completion on load", () => {
  it("completes sign-in using the email stashed in localStorage and cleans up", async () => {
    vi.mocked(isVisitorMagicLink).mockReturnValue(true);
    vi.mocked(subscribeToAuthState).mockImplementation(() => vi.fn());
    window.localStorage.setItem(VISITOR_AUTH_EMAIL_KEY, "visitor@example.com");
    vi.mocked(completeVisitorMagicLink).mockResolvedValue(undefined as never);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(completeVisitorMagicLink).toHaveBeenCalledWith("visitor@example.com", window.location.href),
    );
    expect(window.localStorage.getItem(VISITOR_AUTH_EMAIL_KEY)).toBeNull();
  });

  it("does nothing when the current URL is not a magic link", async () => {
    vi.mocked(isVisitorMagicLink).mockReturnValue(false);
    vi.mocked(subscribeToAuthState).mockImplementation(() => vi.fn());

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(isVisitorMagicLink).toHaveBeenCalled());
    expect(completeVisitorMagicLink).not.toHaveBeenCalled();
  });

  it("logs and swallows an error if completing the magic link fails", async () => {
    vi.mocked(isVisitorMagicLink).mockReturnValue(true);
    vi.mocked(subscribeToAuthState).mockImplementation(() => vi.fn());
    window.localStorage.setItem(VISITOR_AUTH_EMAIL_KEY, "visitor@example.com");
    vi.mocked(completeVisitorMagicLink).mockRejectedValue(new Error("expired link"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith("Sign-in link error:", expect.any(Error)));
    // The stashed email is left in place on failure so a retry can reuse it.
    expect(window.localStorage.getItem(VISITOR_AUTH_EMAIL_KEY)).toBe("visitor@example.com");

    consoleError.mockRestore();
  });

  it("falls back to window.prompt for the email when localStorage has none (cross-device link)", async () => {
    vi.mocked(isVisitorMagicLink).mockReturnValue(true);
    vi.mocked(subscribeToAuthState).mockImplementation(() => vi.fn());
    vi.mocked(completeVisitorMagicLink).mockResolvedValue(undefined as never);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("prompted@example.com");

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(completeVisitorMagicLink).toHaveBeenCalledWith("prompted@example.com", window.location.href),
    );
    expect(promptSpy).toHaveBeenCalled();

    promptSpy.mockRestore();
  });

  it("does nothing when localStorage has no email and the user cancels the prompt", async () => {
    vi.mocked(isVisitorMagicLink).mockReturnValue(true);
    vi.mocked(subscribeToAuthState).mockImplementation(() => vi.fn());
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(promptSpy).toHaveBeenCalled());
    expect(completeVisitorMagicLink).not.toHaveBeenCalled();

    promptSpy.mockRestore();
  });
});

describe("useAuth outside a provider", () => {
  it("throws when called without an enclosing AuthProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow("useAuth must be used within AuthProvider");
    consoleError.mockRestore();
  });
});
