"use client";

import { useState } from "react";
import { Collapsible } from "radix-ui";
import styles from "./FormRow.module.css";

interface FormRowProps {
  label: string;
  value?: React.ReactNode;
  expandable?: boolean;
  // Only meaningful when expandable={false}. Stacks the label above
  // full-width content instead of the compact label-left/value-right row —
  // for fields whose content is too tall/multi-part (several inputs, a
  // photo picker) to sit next to a label on one line.
  stacked?: boolean;
  children: React.ReactNode;
}

// One row shell (label left, value+chevron right) used throughout
// BusinessEventForm's row-list layout. Expandable rows (the default) reveal
// their real input behind a tap via Radix Collapsible, owning their own
// open state internally — same self-managed-disclosure convention as
// DatePickerPopover. expandable={false} rows render children inline instead,
// no chevron, no tap needed — for fields that don't benefit from being
// hidden behind a disclosure (a native <select> that's its own compact
// "dropdown" already, or a field that should just always be visible/editable).
export function FormRow({ label, value, expandable = true, stacked = false, children }: FormRowProps) {
  const [open, setOpen] = useState(false);

  if (!expandable) {
    if (stacked) {
      return (
        <div className={styles.stackedRow}>
          <span className={styles.label}>{label}</span>
          <div className={styles.stackedContent}>{children}</div>
        </div>
      );
    }
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
