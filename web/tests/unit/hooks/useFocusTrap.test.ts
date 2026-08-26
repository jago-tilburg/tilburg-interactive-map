import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

function buildDialog() {
  const dialog = document.createElement("div");
  dialog.tabIndex = -1;
  const first = document.createElement("button");
  first.textContent = "First";
  const middle = document.createElement("button");
  middle.textContent = "Middle";
  const last = document.createElement("button");
  last.textContent = "Last";
  dialog.append(first, middle, last);
  document.body.appendChild(dialog);
  return { dialog, first, middle, last };
}

let dialog: HTMLDivElement;
let outsideButton: HTMLButtonElement;

beforeEach(() => {
  outsideButton = document.createElement("button");
  outsideButton.textContent = "Opener";
  document.body.appendChild(outsideButton);
  outsideButton.focus();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useFocusTrap", () => {
  it("moves focus to the dialog when it opens", () => {
    ({ dialog } = buildDialog());
    const ref = createRef<HTMLDivElement>();
    ref.current = dialog;

    renderHook(({ open }) => useFocusTrap(ref, open, vi.fn()), { initialProps: { open: true } });

    expect(document.activeElement).toBe(dialog);
  });

  it("calls onClose on Escape", () => {
    ({ dialog } = buildDialog());
    const ref = createRef<HTMLDivElement>();
    ref.current = dialog;
    const onClose = vi.fn();

    renderHook(() => useFocusTrap(ref, true, onClose));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps Tab forward from the last focusable element to the first", () => {
    const built = buildDialog();
    dialog = built.dialog;
    const ref = createRef<HTMLDivElement>();
    ref.current = dialog;

    renderHook(() => useFocusTrap(ref, true, vi.fn()));

    built.last.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    expect(document.activeElement).toBe(built.first);
  });

  it("wraps Shift+Tab backward from the first focusable element to the last", () => {
    const built = buildDialog();
    dialog = built.dialog;
    const ref = createRef<HTMLDivElement>();
    ref.current = dialog;

    renderHook(() => useFocusTrap(ref, true, vi.fn()));

    built.first.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    expect(document.activeElement).toBe(built.last);
  });

  it("restores focus to the previously focused element on close", () => {
    ({ dialog } = buildDialog());
    const ref = createRef<HTMLDivElement>();
    ref.current = dialog;

    const { rerender } = renderHook(({ open }) => useFocusTrap(ref, open, vi.fn()), {
      initialProps: { open: true },
    });
    expect(document.activeElement).toBe(dialog);

    rerender({ open: false });

    expect(document.activeElement).toBe(outsideButton);
  });

  it("does nothing while closed", () => {
    ({ dialog } = buildDialog());
    const ref = createRef<HTMLDivElement>();
    ref.current = dialog;
    const onClose = vi.fn();

    renderHook(() => useFocusTrap(ref, false, onClose));

    expect(document.activeElement).toBe(outsideButton);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
