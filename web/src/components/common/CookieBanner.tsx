"use client";

import { useState, useSyncExternalStore } from "react";
import { hasCookieConsent, acceptNecessaryOnly, acceptAll } from "@/lib/cookieConsent";
import { PrivacyModal } from "./PrivacyModal";
import styles from "./CookieBanner.module.css";

// No real external subscription needed — consent, once read, doesn't change
// from outside this component during its lifetime.
function subscribeToNothing() {
  return () => {};
}

export function CookieBanner() {
  // Renders as "consent already given" for the server pass and the initial
  // client (pre-hydration) pass — avoids a hydration mismatch and avoids the
  // classic isClient useEffect+setState antipattern — then swaps to the real
  // localStorage value after mount.
  const storedConsent = useSyncExternalStore(
    subscribeToNothing,
    hasCookieConsent,
    /* v8 ignore next -- getServerSnapshot only runs during an actual server render or the
       initial hydration pass; RTL's render() does neither, so this is never invoked here. */
    () => true,
  );
  const [justAccepted, setJustAccepted] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  if (storedConsent || justAccepted) return null;

  function handleNecessaryOnly() {
    acceptNecessaryOnly();
    setJustAccepted(true);
  }

  function handleAcceptAll() {
    acceptAll();
    setJustAccepted(true);
  }

  return (
    <div className={styles.banner} role="dialog" aria-label="Cookiemelding">
      <p>
        We gebruiken functionele cookies/lokale opslag om likes, ratings en accounts te laten
        werken. Met jouw toestemming gebruiken we ook Google Analytics om te zien welke
        onderdelen van de app gebruikt worden.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.infoButton} onClick={() => setPrivacyOpen(true)}>
          Meer info
        </button>
        <button type="button" className={styles.necessaryButton} onClick={handleNecessaryOnly}>
          Alleen noodzakelijk
        </button>
        <button type="button" className={styles.acceptButton} onClick={handleAcceptAll}>
          Accepteren
        </button>
      </div>
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}
