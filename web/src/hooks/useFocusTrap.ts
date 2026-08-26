import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared focus-management for the app's modals (both Modal.tsx and
// MenuModal.tsx, which reimplements its own dialog markup): on open, moves
// focus into the dialog and remembers what was focused before; while open,
// Escape closes it and Tab/Shift+Tab cycle within its focusable descendants
// instead of escaping to the page behind it; on close, focus returns to
// whatever triggered the modal.
export function useFocusTrap(dialogRef: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  // Callers typically pass a fresh inline onClose on every render (e.g.
  // onClose={() => setOpen(false)}) — reading it via a ref instead of a
  // useEffect dependency keeps this effect from tearing down and rebuilding
  // (which re-runs the "remember + restore focus" cleanup) on every
  // keystroke inside the dialog, which was stealing focus mid-typing.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [open, dialogRef]);
}
