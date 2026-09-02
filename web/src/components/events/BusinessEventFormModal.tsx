"use client";

import { Modal } from "@/components/common/Modal";
import { BusinessEventForm } from "./BusinessEventForm";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

interface BusinessEventFormModalProps {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  editingEvent: BusinessEvent | null;
  duplicateFrom?: BusinessEvent | null;
  umbrellaEvents: UmbrellaEvent[];
}

// A thin wrapper around BusinessEventForm — kept for AdminPanel, which still
// needs the form as a floating window rather than inline on a page
// (PLAN-INLOGGEN.md §9). /eventbeheer's "Nieuw event" tab uses BusinessEventForm
// directly, without this Modal.
export function BusinessEventFormModal({
  open,
  onClose,
  ownerId,
  editingEvent,
  duplicateFrom,
  umbrellaEvents,
}: BusinessEventFormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={editingEvent ? "Evenement bewerken" : "Nieuw evenement"}>
      <BusinessEventForm
        active={open}
        ownerId={ownerId}
        editingEvent={editingEvent}
        duplicateFrom={duplicateFrom}
        umbrellaEvents={umbrellaEvents}
        onDone={onClose}
      />
    </Modal>
  );
}
