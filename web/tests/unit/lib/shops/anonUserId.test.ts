import { describe, it, expect, beforeEach } from "vitest";
import { getAnonUserId, getRememberedUserName, rememberUserName } from "@/lib/shops/anonUserId";

beforeEach(() => {
  window.localStorage.clear();
});

describe("getAnonUserId", () => {
  it("generates and persists a new id when none exists", () => {
    const id = getAnonUserId();
    expect(id).toMatch(/^user-/);
    expect(window.localStorage.getItem("tilburg-user-id")).toBe(id);
  });

  it("returns the same id on subsequent calls", () => {
    const first = getAnonUserId();
    const second = getAnonUserId();
    expect(second).toBe(first);
  });
});

describe("getRememberedUserName / rememberUserName", () => {
  it("returns an empty string when nothing is remembered", () => {
    expect(getRememberedUserName()).toBe("");
  });

  it("persists and returns a remembered name", () => {
    rememberUserName("Jago");
    expect(getRememberedUserName()).toBe("Jago");
  });
});
