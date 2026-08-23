"use client";

import { Modal } from "./Modal";
import styles from "./PrivacyModal.module.css";

interface PrivacyModalProps {
  open: boolean;
  onClose: () => void;
}

export function PrivacyModal({ open, onClose }: PrivacyModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Privacybeleid">
      <div className={styles.content}>
        <p>
          2happies gebruikt een echte, beveiligde backend (Firebase) om accounts en gegevens te
          bewaren — dit is geen demo of prototype.
        </p>

        <h3>Wat we bewaren</h3>
        <ul>
          <li>
            <strong>Bezoekersaccount</strong> (optioneel): e-mailadres en weergavenaam, aangemaakt
            via echte Firebase-authenticatie.
          </li>
          <li>
            <strong>Bedrijfsaccount</strong> (optioneel): bedrijfsnaam en e-mailadres, plus de
            evenementen die je aanmaakt (titel, locatie, datum, prijzen).
          </li>
          <li>
            <strong>Likes, ratings, reacties en reviews</strong> op broodjeszaken — gekoppeld aan je
            account als je bent ingelogd, anders aan een willekeurig gegenereerd lokaal ID dat in de
            browser van je apparaat wordt opgeslagen (<code>localStorage</code>).
          </li>
          <li>
            <strong>Bewaarde evenementen</strong> als je bent ingelogd als bezoeker.
          </li>
          <li>
            Bezoekstatistieken per evenement/broodjeszaak (aantal weergaven, klikken, interesse) —
            niet aan een persoon te koppelen.
          </li>
        </ul>

        <h3>Cookies &amp; lokale opslag</h3>
        <p>
          We gebruiken <code>localStorage</code> om je anonieme ID en (indien van toepassing)
          Google Analytics-gegevens te bewaren. Dit is functioneel noodzakelijk voor likes/ratings
          zonder account; Analytics wordt alleen geladen als hiervoor toestemming is gegeven of het
          expliciet is ingeschakeld.
        </p>

        <h3>Derde partijen</h3>
        <ul>
          <li>Google Maps Platform — voor het tonen van de kaart.</li>
          <li>Google Analytics (indien ingeschakeld) — geanonimiseerde gebruiksstatistieken.</li>
        </ul>

        <h3>Jouw rechten</h3>
        <p>
          Je kunt je account en alle bijbehorende gegevens op elk moment zelf verwijderen via
          &quot;Account verwijderen&quot; in je accountmenu. Vragen over je gegevens? Neem contact
          op via de contactgegevens op de website.
        </p>
      </div>
    </Modal>
  );
}
