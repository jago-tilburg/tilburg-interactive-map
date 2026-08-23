import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "@/hooks/useIsMobile";

function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  let changeHandler: (() => void) | null = null;
  const mql = {
    get matches() {
      return matches;
    },
    addEventListener: (_event: string, cb: () => void) => {
      changeHandler = cb;
    },
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return {
    setMatches(next: boolean) {
      matches = next;
      changeHandler?.();
    },
  };
}

let originalMatchMedia: typeof window.matchMedia;

beforeEach(() => {
  originalMatchMedia = window.matchMedia;
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("useIsMobile", () => {
  it("returns false when the viewport is wider than the mobile breakpoint", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true when the viewport matches the mobile breakpoint", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("updates when the viewport crosses the breakpoint", () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => media.setMatches(true));
    expect(result.current).toBe(true);
  });

  it("unsubscribes on unmount", () => {
    mockMatchMedia(false);
    const { unmount } = renderHook(() => useIsMobile());
    const removeEventListener = (window.matchMedia("") as unknown as { removeEventListener: () => void })
      .removeEventListener;
    unmount();
    expect(removeEventListener).toHaveBeenCalled();
  });
});
