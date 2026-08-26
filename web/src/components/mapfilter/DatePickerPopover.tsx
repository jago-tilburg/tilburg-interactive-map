"use client";

import { useState } from "react";
import { Popover } from "radix-ui";
import { DayPicker } from "react-day-picker";
import { nl } from "date-fns/locale";
import type { BusinessEvent } from "@/types/events";
import styles from "./DatePickerPopover.module.css";

interface DatePickerPopoverProps {
  triggerLabel: string;
  triggerClassName: string;
  events: BusinessEvent[];
  today: string;
  onSelectDate: (date: string) => void;
}

function hasEventOn(events: BusinessEvent[], date: string): boolean {
  return events.some((e) => e.startDate <= date && date <= e.endDate);
}

// Local-date (not UTC) formatting — matches the YYYY-MM-DD strings this
// filter state already uses everywhere else (see filterHelpers.ts).
function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYMD(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Built on Radix's Popover (outside-click-to-close, Escape, collision-aware
// positioning — none of which the hand-rolled version this replaces had at
// all) + react-day-picker's Calendar for the actual month grid (replacing
// the hand-rolled month-math in lib/filters/monthGrid.ts). Owns its own
// trigger button and open state internally (Popover.Trigger/Popover.Root),
// rather than taking open/onClose from the parent — MapFilterPanel just
// passes through the label/className for the button and the date data.
export function DatePickerPopover({
  triggerLabel,
  triggerClassName,
  events,
  today,
  onSelectDate,
}: DatePickerPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={triggerClassName} style={{ width: "100%" }}>
          {triggerLabel}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popover} sideOffset={6} align="start" aria-label="Kies een datum">
          <DayPicker
            mode="single"
            locale={nl}
            defaultMonth={parseYMD(today)}
            labels={{
              labelPrevious: () => "Vorige maand",
              labelNext: () => "Volgende maand",
            }}
            modifiers={{ hasEvent: (date) => hasEventOn(events, toYMD(date)) }}
            modifiersClassNames={{ hasEvent: styles.hasEvent }}
            onSelect={(date) => {
              if (!date) return;
              onSelectDate(toYMD(date));
              setOpen(false);
            }}
            classNames={{
              root: styles.rdpRoot,
              months: styles.rdpMonths,
              month: styles.rdpMonth,
              nav: styles.rdpNav,
              button_previous: styles.rdpNavButton,
              button_next: styles.rdpNavButton,
              month_caption: styles.header,
              caption_label: styles.captionLabel,
              month_grid: styles.grid,
              weekdays: styles.weekdays,
              weekday: styles.weekday,
              weeks: styles.weeks,
              week: styles.week,
              day: styles.day,
              day_button: styles.dayButton,
              outside: styles.dayOutside,
              selected: styles.daySelected,
              today: styles.dayToday,
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
