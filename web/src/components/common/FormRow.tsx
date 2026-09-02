"use client";

import { useState } from "react";
import { Collapsible } from "radix-ui";
import styles from "./FormRow.module.css";

interface FormRowProps {
  label: string;
  value?: React.ReactNode;
  expandable?: boolean;
  children: React.ReactNode;
}

// One row shell (label left, value+chevron right) used throughout
// BusinessEventForm's row-list layout. Expandable rows (the default) reveal
// their real input behind a tap via Radix Collapsible, owning their own
// open state internally — same self-managed-disclosure convention as
// DatePickerPopover. expandable={false} rows render children inline in the
// same row shell instead, no chevron — for fields that already have their
// own built-in dropdown (a native <select>) and don't need a second
// expand/collapse mechanism on top of it.
export function FormRow({ label, value, expandable = true, children }: FormRowProps) {
  const [open, setOpen] = useState(false);

  if (!expandable) {
    return (
      <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        <div className={styles.staticValue}>{children}</div>
      </div>
    );
  }

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger type="button" className={styles.row}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value} data-empty={!value || undefined}>
          {value}
          <span className={styles.chevron} data-state={open ? "open" : "closed"}>
            ›
          </span>
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content className={styles.content}>{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}
