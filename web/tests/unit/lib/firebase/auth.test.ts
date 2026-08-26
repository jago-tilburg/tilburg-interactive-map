import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuthInstance = { name: "mock-auth" };

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => mockAuthInstance),
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
  EmailAuthProvider: { credential: vi.fn((email, password) => ({ email, password })) },
  reauthenticateWithCredential: vi.fn(),
  updatePassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn(),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {
    return { providerId: "google.com" };
  }),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  getAdditionalUserInfo: vi.fn(),
}));

vi.mock("@/lib/firebase/app", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "mock-app" })),
}));

import {
  getFirebaseAuth,
  subscribeToAuthState,
  signInWithPassword,
  registerWithPassword,
  signInWithGoogle,
  getGoogleRedirectResult,
  isNewGoogleUser,
  sendPasswordReset,
  sendVerificationEmail,
  reloadCurrentUser,
  signOutCurrentUser,
  deleteCurrentUser,
  changeAccountPassword,
} from "@/lib/firebase/auth";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
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

describe("signInWithPassword / registerWithPassword", () => {
  it("signInWithPassword delegates to signInWithEmailAndPassword", async () => {
    await signInWithPassword("user@example.com", "pw123456");
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(mockAuthInstance, "user@example.com", "pw123456");
  });

  it("registerWithPassword delegates to createUserWithEmailAndPassword", async () => {
    await registerWithPassword("user@example.com", "pw123456");
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(mockAuthInstance, "user@example.com", "pw123456");
  });
});

describe("signInWithGoogle", () => {
  it("resolves via signInWithPopup on success", async () => {
    const cred = { user: { uid: "u1" } };
    vi.mocked(signInWithPopup).mockResolvedValue(cred as never);
    const result = await signInWithGoogle();
    expect(signInWithPopup).toHaveBeenCalledWith(mockAuthInstance, expect.objectContaining({ providerId: "google.com" }));
    expect(result).toBe(cred);
  });

  it("falls back to signInWithRedirect when the popup is blocked, returning null", async () => {
    vi.mocked(signInWithPopup).mockRejectedValue({ code: "auth/popup-blocked" });
    vi.mocked(signInWithRedirect).mockResolvedValue(undefined as never);
    const result = await signInWithGoogle();
    expect(signInWithRedirect).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("falls back to redirect when popups aren't supported in this environment", async () => {
    vi.mocked(signInWithPopup).mockRejectedValue({ code: "auth/operation-not-supported-in-this-environment" });
    vi.mocked(signInWithRedirect).mockResolvedValue(undefined as never);
    const result = await signInWithGoogle();
    expect(signInWithRedirect).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("does not fall back to redirect when the user just closes the popup", async () => {
    const err = { code: "auth/popup-closed-by-user" };
    vi.mocked(signInWithPopup).mockRejectedValue(err);
    await expect(signInWithGoogle()).rejects.toBe(err);
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });

  it("rethrows a rejection with no error code at all, without falling back to redirect", async () => {
    const err = new Error("network down");
    vi.mocked(signInWithPopup).mockRejectedValue(err);
    await expect(signInWithGoogle()).rejects.toBe(err);
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });
});

describe("getGoogleRedirectResult", () => {
  it("delegates to getRedirectResult", async () => {
    await getGoogleRedirectResult();
    expect(getRedirectResult).toHaveBeenCalledWith(mockAuthInstance);
  });
});

describe("isNewGoogleUser", () => {
  it("returns true when the additional user info flags a new user", () => {
    vi.mocked(getAdditionalUserInfo).mockReturnValue({ isNewUser: true } as never);
    expect(isNewGoogleUser({} as never)).toBe(true);
  });

  it("returns false for a returning user", () => {
    vi.mocked(getAdditionalUserInfo).mockReturnValue({ isNewUser: false } as never);
    expect(isNewGoogleUser({} as never)).toBe(false);
  });

  it("returns false when additional user info is unavailable", () => {
    vi.mocked(getAdditionalUserInfo).mockReturnValue(null);
    expect(isNewGoogleUser({} as never)).toBe(false);
  });
});

describe("sendPasswordReset", () => {
  it("delegates to sendPasswordResetEmail", async () => {
    await sendPasswordReset("user@example.com");
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(mockAuthInstance, "user@example.com");
  });
});

describe("sendVerificationEmail", () => {
  it("delegates to sendEmailVerification", async () => {
    const user = { uid: "u1" };
    await sendVerificationEmail(user as never);
    expect(sendEmailVerification).toHaveBeenCalledWith(user);
  });
});

describe("reloadCurrentUser", () => {
  it("calls reload() on the given user", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const user = { uid: "u1", reload };
    await reloadCurrentUser(user as never);
    expect(reload).toHaveBeenCalled();
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

describe("changeAccountPassword", () => {
  it("reauthenticates with the current password, then updates to the new one", async () => {
    const user = { uid: "u1", email: "user@example.com" };
    vi.mocked(reauthenticateWithCredential).mockResolvedValue(undefined as never);
    vi.mocked(updatePassword).mockResolvedValue(undefined as never);

    await changeAccountPassword(user as never, "oldpw123", "newpw123");

    expect(EmailAuthProvider.credential).toHaveBeenCalledWith("user@example.com", "oldpw123");
    expect(reauthenticateWithCredential).toHaveBeenCalledWith(user, { email: "user@example.com", password: "oldpw123" });
    expect(updatePassword).toHaveBeenCalledWith(user, "newpw123");
  });

  it("propagates a reauthentication failure without calling updatePassword", async () => {
    const user = { uid: "u1", email: "user@example.com" };
    const err = new Error("auth/wrong-password");
    vi.mocked(reauthenticateWithCredential).mockRejectedValue(err);

    await expect(changeAccountPassword(user as never, "wrong", "newpw123")).rejects.toThrow(err);
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("falls back to an empty email when the user has none", async () => {
    const user = { uid: "u1", email: null };
    vi.mocked(reauthenticateWithCredential).mockResolvedValue(undefined as never);
    vi.mocked(updatePassword).mockResolvedValue(undefined as never);

    await changeAccountPassword(user as never, "oldpw123", "newpw123");

    expect(EmailAuthProvider.credential).toHaveBeenCalledWith("", "oldpw123");
  });
});
