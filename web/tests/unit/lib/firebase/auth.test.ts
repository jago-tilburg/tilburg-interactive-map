import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuthInstance = { name: "mock-auth" };

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => mockAuthInstance),
  onAuthStateChanged: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
  signInWithEmailLink: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("@/lib/firebase/app", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "mock-app" })),
}));

import {
  getFirebaseAuth,
  subscribeToAuthState,
  visitorActionCodeSettings,
  sendVisitorMagicLink,
  isVisitorMagicLink,
  completeVisitorMagicLink,
  loginBusiness,
  registerBusiness,
  loginAdmin,
  signOutCurrentUser,
  deleteCurrentUser,
} from "@/lib/firebase/auth";
import {
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
} from "firebase/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getFirebaseAuth", () => {
  it("returns an Auth instance bound to the app", () => {
    expect(getFirebaseAuth()).toBe(mockAuthInstance);
  });
});

describe("subscribeToAuthState", () => {
  it("delegates to onAuthStateChanged with the auth instance", () => {
    const cb = vi.fn();
    subscribeToAuthState(cb);
    expect(onAuthStateChanged).toHaveBeenCalledWith(mockAuthInstance, cb);
  });
});

describe("visitorActionCodeSettings", () => {
  it("builds settings from the current location", () => {
    const settings = visitorActionCodeSettings();
    expect(settings).toEqual({
      url: window.location.origin + window.location.pathname,
      handleCodeInApp: true,
    });
  });
});

describe("sendVisitorMagicLink", () => {
  it("calls sendSignInLinkToEmail with actionCodeSettings", async () => {
    await sendVisitorMagicLink("visitor@example.com");
    expect(sendSignInLinkToEmail).toHaveBeenCalledWith(
      mockAuthInstance,
      "visitor@example.com",
      expect.objectContaining({ handleCodeInApp: true }),
    );
  });
});

describe("isVisitorMagicLink", () => {
  it("delegates to isSignInWithEmailLink", () => {
    vi.mocked(isSignInWithEmailLink).mockReturnValue(true);
    expect(isVisitorMagicLink("https://example.com/?apiKey=x")).toBe(true);
    expect(isSignInWithEmailLink).toHaveBeenCalledWith(mockAuthInstance, "https://example.com/?apiKey=x");
  });
});

describe("completeVisitorMagicLink", () => {
  it("delegates to signInWithEmailLink", async () => {
    await completeVisitorMagicLink("visitor@example.com", "https://example.com/link");
    expect(signInWithEmailLink).toHaveBeenCalledWith(
      mockAuthInstance,
      "visitor@example.com",
      "https://example.com/link",
    );
  });
});

describe("loginBusiness / registerBusiness / loginAdmin", () => {
  it("loginBusiness delegates to signInWithEmailAndPassword", async () => {
    await loginBusiness("biz@example.com", "pw123456");
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(mockAuthInstance, "biz@example.com", "pw123456");
  });

  it("registerBusiness delegates to createUserWithEmailAndPassword", async () => {
    await registerBusiness("biz@example.com", "pw123456");
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(mockAuthInstance, "biz@example.com", "pw123456");
  });

  it("loginAdmin uses the same signInWithEmailAndPassword flow as business login", async () => {
    await loginAdmin("admin@example.com", "pw123456");
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(mockAuthInstance, "admin@example.com", "pw123456");
  });
});

describe("signOutCurrentUser", () => {
  it("delegates to signOut", async () => {
    await signOutCurrentUser();
    expect(signOut).toHaveBeenCalledWith(mockAuthInstance);
  });
});

describe("deleteCurrentUser", () => {
  it("delegates to deleteUser with the given user", async () => {
    const user = { uid: "u1" };
    await deleteCurrentUser(user as never);
    expect(deleteUser).toHaveBeenCalledWith(user);
  });
});
