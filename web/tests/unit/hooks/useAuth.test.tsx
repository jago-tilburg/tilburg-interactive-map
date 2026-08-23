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

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import {
  subscribeToAuthState,
  isVisitorMagicLink,
  completeVisitorMagicLink,
  VISITOR_AUTH_EMAIL_KEY,
} from "@/lib/firebase/auth";
import { getVisitorProfile, createVisitorProfile, getBusinessProfile } from "@/lib/firebase/firestore";
import { isUidAdmin } from "@/lib/firebase/admin";

type AuthCallback = (user: User | null) => void;

function TestConsumer() {
  const { currentUser, isAdmin, currentVisitor, currentBusiness, loading, suppressAutoProfileLoadRef } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{currentUser?.uid ?? "none"}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <span data-testid="visitor">{currentVisitor?.displayName ?? "none"}</span>
      <span data-testid="business">{currentBusiness?.businessName ?? "none"}</span>
      <button onClick={() => { suppressAutoProfileLoadRef.current = true; }}>suppress</button>
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

  it("resets all account state on sign-out", async () => {
    vi.mocked(isUidAdmin).mockResolvedValue(true);
    const fire = captureAuthCallback();
    fire(fakeUser);
    await waitFor(() => expect(screen.getByTestId("admin")).toHaveTextContent("true"));

    fire(null);
    await waitFor(() => expect(screen.getByTestId("admin")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
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
});
