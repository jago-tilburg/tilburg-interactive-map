"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import { Dialog } from "radix-ui";
import styles from "./Modal.module.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  // "detail" mirrors the prototype's #shopDetailModal treatment (shared by
  // shop/business-event/umbrella-event detail views): full-screen,
  // edge-to-edge on mobile instead of a small floating card, since tapping a
  // map marker is the app's most common mobile interaction and merits it.
  // Every other modal (forms, auth, menus) stays the plain floating card.
  variant?: "default" | "detail";
  // Opt-in only — every other modal's title stays left-aligned next to the
  // close button (the long-standing default). RoleChoiceModal is the one
  // exception (PLAN-INLOGGEN.md-adjacent welcome screen), not a general
  // redesign.
  centerTitle?: boolean;
}

const SWIPE_CLOSE_THRESHOLD_PX = 110;

// Built on Radix's Dialog primitive for focus trap/initial focus/Escape/
// outside-click-close/focus-restoration — see this session's earlier
// hand-rolled useFocusTrap.ts for what this replaces. Swipe-to-close (mobile
// only in practice — the drag handle is CSS-hidden on desktop) is app-
// specific behavior Radix doesn't provide, so it's kept as manual touch
// handlers scoped to the header, mirroring the prototype's
// setupShopDetailSwipeToClose(). Scoped to the header rather than the whole
// dialog so it never fights with scrolling a long body (comment lists,
// forms, etc).
export function Modal({ open, onClose, title, children, variant = "default", centerTitle = false }: ModalProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartYRef = useRef<number | null>(null);
  // Radix's default onCloseAutoFocus tries to refocus its own internal
  // Dialog.Trigger — which is always null here, since open/close is
  // controlled externally rather than via a Dialog.Trigger rendered inside
  // this tree — and unconditionally preventDefaults, which blocks
  // FocusScope's own "restore to whatever was focused before" fallback too.
  // A layout effect (not a regular effect) guarantees this runs before
  // Radix's own focus-scope passive effect moves focus into the dialog,
  // regardless of tree position.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) previouslyFocusedRef.current = document.activeElement as HTMLElement;
  }, [open]);

  function handleTouchStart(e: ReactTouchEvent) {
    dragStartYRef.current = e.touches[0].clientY;
  }

  function handleTouchMove(e: ReactTouchEvent) {
    if (dragStartYRef.current === null) return;
    const delta = e.touches[0].clientY - dragStartYRef.current;
    if (delta > 0) setDragOffset(delta);
  }

  function handleTouchEnd() {
    if (dragOffset > SWIPE_CLOSE_THRESHOLD_PX) onClose();
    setDragOffset(0);
    dragStartYRef.current = null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay role="presentation" className={styles.backdrop} />
        <div className={`${styles.overlay} ${variant === "detail" ? styles.detailOverlay : ""}`}>
          <Dialog.Content
            className={`${styles.dialog} ${variant === "detail" ? styles.detailDialog : ""}`}
            aria-describedby={undefined}
            aria-modal="true"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              previouslyFocusedRef.current?.focus();
            }}
            style={dragOffset ? { transform: `translateY(${dragOffset}px)`, transition: "none" } : undefined}
          >
            <div
              className={`${styles.header} ${centerTitle ? styles.headerCentered : ""}`}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <span className={styles.dragHandle} aria-hidden="true" />
              {centerTitle && <span className={styles.headerSpacer} aria-hidden="true" />}
              <Dialog.Title asChild>
                <h2>{title}</h2>
              </Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className={styles.closeButton} aria-label="Sluiten">
                  ×
                </button>
              </Dialog.Close>
            </div>
            <div className={styles.body}>{children}</div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
