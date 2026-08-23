"use client";

import { useState } from "react";
import { daysInMonth, leadingBlankCount, monthLabel, shiftMonth, WEEKDAY_LABELS } from "@/lib/filters/monthGrid";
import type { BusinessEvent } from "@/types/events";
import styles from "./DatePickerPopover.module.css";

interface DatePickerPopoverProps {
  open: boolean;
  onClose: () => void;
  events: BusinessEvent[];
  today: string;
  onSelectDate: (date: string) => void;
}

function hasEventOn(events: BusinessEvent[], date: string): boolean {
  return events.some((e) => e.startDate <= date && date <= e.endDate);
}

export function DatePickerPopover({ open, onClose, events, today, onSelectDate }: DatePickerPopoverProps) {
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const [view, setView] = useState({ year: todayYear, month: todayMonth - 1 });

  if (!open) return null;

  const days = daysInMonth(view.year, view.month);
  const blanks = leadingBlankCount(view.year, view.month);

  return (
    <div className={styles.popover} role="dialog" aria-label="Kies een datum">
      <div className={styles.header}>
        <button type="button" aria-label="Vorige maand" onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))}>
          ‹
        </button>
        <span>{monthLabel(view.year, view.month)}</span>
        <button type="button" aria-label="Volgende maand" onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))}>
          ›
        </button>
      </div>
      <div className={styles.weekdays}>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className={styles.grid}>
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank-${i}`} className={styles.blank} />
        ))}
        {days.map((date) => (
          <button
            key={date}
            type="button"
            className={styles.day}
            onClick={() => {
              onSelectDate(date);
              onClose();
            }}
          >
            {Number(date.slice(-2))}
            {hasEventOn(events, date) && <span className={styles.dot} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}
