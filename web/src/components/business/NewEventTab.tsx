"use client";

import { BusinessEventForm } from "@/components/events/BusinessEventForm";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./NewEventTab.module.css";

interface NewEventTabProps {
  active: boolean;
  ownerId: string;
  editingEvent: BusinessEvent | null;
  duplicateFrom: BusinessEvent | null;
  umbrellaEvents: UmbrellaEvent[];
  onDone: () => void;
}

// A dun omhulsel around BusinessEventForm — the form itself moved out of its
// modal (PLAN-INLOGGEN.md §9); this tab just gives it a heading and a
// max-width so it doesn't stretch edge-to-edge on desktop.
export function NewEventTab({ active, ownerId, editingEvent, duplicateFrom, umbrellaEvents, onDone }: NewEventTabProps) {
  return (
    <div className={styles.wrapper}>
      <h2>{editingEvent ? "Evenement bewerken" : "Nieuw evenement"}</h2>
      <BusinessEventForm
        active={active}
        ownerId={ownerId}
        editingEvent={editingEvent}
        duplicateFrom={duplicateFrom}
        umbrellaEvents={umbrellaEvents}
        onDone={onDone}
      />
    </div>
  );
}
