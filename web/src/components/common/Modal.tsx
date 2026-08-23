"use client";

import { useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import styles from "./Modal.module.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const SWIPE_CLOSE_THRESHOLD_PX = 110;

// Swipe-to-close, mobile only in practice (the drag handle is CSS-hidden on
// desktop): dragging the header down past the threshold closes the modal,
// mirroring the prototype's setupShopDetailSwipeToClose(). Scoped to the
// header rather than the whole dialog so it never fights with scrolling a
// long body (comment lists, forms, etc).
export function Modal({ open, onClose, title, children }: ModalProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartYRef = useRef<number | null>(null);

  if (!open) return null;

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
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={dragOffset ? { transform: `translateY(${dragOffset}px)`, transition: "none" } : undefined}
      >
        <div
          className={styles.header}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <span className={styles.dragHandle} aria-hidden="true" />
          <h2>{title}</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Sluiten">
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
