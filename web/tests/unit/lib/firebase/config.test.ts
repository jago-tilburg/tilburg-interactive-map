import { describe, it, expect, beforeEach, vi } from "vitest";

const ENV_VARS = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_DATABASE_URL: "https://test-default-rtdb.firebaseio.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "test.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "12345",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:12345:web:abcdef",
};

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV_VARS)) {
    vi.stubEnv(key, value);
  }
});

describe("firebaseConfig", () => {
  it("reads every NEXT_PUBLIC_FIREBASE_* env var into the config object", async () => {
    vi.resetModules();
    const { firebaseConfig } = await import("@/lib/firebase/config");
    expect(firebaseConfig).toEqual({
      apiKey: ENV_VARS.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: ENV_VARS.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      databaseURL: ENV_VARS.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      projectId: ENV_VARS.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: ENV_VARS.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: ENV_VARS.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: ENV_VARS.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  });
});
