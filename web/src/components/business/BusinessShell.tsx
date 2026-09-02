"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "radix-ui";
import { useAuth } from "@/hooks/useAuth";
import { EmailVerifyNotice } from "@/components/auth/EmailVerifyNotice";
import { InsightsTab } from "./InsightsTab";
import { NewEventTab } from "./NewEventTab";
import { BusinessProfileTab } from "./BusinessProfileTab";
import { subscribeMyBusinessEvents } from "@/lib/firebase/businessEvents";
import { subscribeUmbrellaEvents } from "@/lib/firebase/umbrellaEvents";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./BusinessShell.module.css";

type TabKey = "inzicht" | "nieuw" | "profiel";

function tabFromParam(value: string | null): TabKey {
  return value === "nieuw" || value === "profiel" ? value : "inzicht";
}

// The schermvullende eventomgeving (PLAN-INLOGGEN.md §9) — no kaart, no
// mapheader. Tab state lives in the URL (?tab=) so refresh and the browser
// back button both work.
export function BusinessShell() {
  const { currentBusiness, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabKey>(() => tabFromParam(searchParams.get("tab")));
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [umbrellas, setUmbrellas] = useState<UmbrellaEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<BusinessEvent | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<BusinessEvent | null>(null);

  useEffect(() => {
    if (!currentBusiness) return;
    const unsubEvents = subscribeMyBusinessEvents(currentBusiness.uid, setEvents);
    const unsubUmbrellas = subscribeUmbrellaEvents(setUmbrellas);
    return () => {
      unsubEvents();
      unsubUmbrellas();
    };
  }, [currentBusiness]);

  function changeTab(next: TabKey) {
    setTab(next);
    router.replace(`/bedrijf?tab=${next}`, { scroll: false });
  }

  function openCreateForm() {
    setEditingEvent(null);
    setDuplicateFrom(null);
    changeTab("nieuw");
  }

  function openEditForm(ev: BusinessEvent) {
    setEditingEvent(ev);
    setDuplicateFrom(null);
    changeTab("nieuw");
  }

  function openDuplicateForm(ev: BusinessEvent) {
    setEditingEvent(null);
    setDuplicateFrom(ev);
    changeTab("nieuw");
  }

  // The form's "opslaan" and "annuleren" both land here — same single
  // callback the old modal used as onClose for both (BusinessEventForm's own
  // doc comment). Springt naar Inzicht, zoals het plan voorschrijft.
  function handleFormDone() {
    setEditingEvent(null);
    setDuplicateFrom(null);
    changeTab("inzicht");
  }

  // A direct link to /bedrijf with no business profile must not render an
  // empty dashboard (PLAN-INLOGGEN.md §9) — send it back to the map instead.
  useEffect(() => {
    if (!loading && !currentBusiness) router.replace("/");
  }, [loading, currentBusiness, router]);

  if (!currentBusiness) return null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.brand}>2happies</span>
        <button type="button" className={styles.backLink} onClick={() => router.push("/")}>
          ← Naar de kaart
        </button>
      </div>
      <EmailVerifyNotice />

      <Tabs.Root value={tab} onValueChange={(v) => changeTab(v as TabKey)} className={styles.tabsRoot}>
        <Tabs.List className={styles.tabs}>
          <Tabs.Trigger value="inzicht" className={tab === "inzicht" ? styles.tabActive : styles.tab}>
            Inzicht
          </Tabs.Trigger>
          <Tabs.Trigger value="nieuw" className={tab === "nieuw" ? styles.tabActive : styles.tab}>
            Nieuw event
          </Tabs.Trigger>
          <Tabs.Trigger value="profiel" className={tab === "profiel" ? styles.tabActive : styles.tab}>
            Profiel
          </Tabs.Trigger>
        </Tabs.List>

        <div className={styles.content}>
          <Tabs.Content value="inzicht">
            <InsightsTab
              events={events}
              umbrellaEvents={umbrellas}
              onCreate={openCreateForm}
              onEdit={openEditForm}
              onDuplicate={openDuplicateForm}
            />
          </Tabs.Content>
          <Tabs.Content value="nieuw">
            <NewEventTab
              active={tab === "nieuw"}
              ownerId={currentBusiness.uid}
              editingEvent={editingEvent}
              duplicateFrom={duplicateFrom}
              umbrellaEvents={umbrellas}
              onDone={handleFormDone}
            />
          </Tabs.Content>
          <Tabs.Content value="profiel">
            <BusinessProfileTab />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}
