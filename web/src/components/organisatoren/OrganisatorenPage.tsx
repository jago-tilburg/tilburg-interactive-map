import { PageHeader } from "@/components/common/PageHeader";
import { EventMarkerPreview } from "@/components/map/EventMarkerPreview";
import styles from "./OrganisatorenPage.module.css";

// Update this once there's a real inbox to send interest to — nothing in
// the codebase publishes a public contact address today (privacybeleid's
// 2happies@bastiaanson.com is the legal/support contact, not obviously the
// right box for event-listing leads).
const CONTACT_MAILTO = "mailto:evenementen@2happies.nl?subject=Evenement%20aanmelden%20op%202happies";

// Marketing/explainer page for prospective event organizers — "what do we
// offer, what does it cost, what do you need to get started". Reuses the
// same PageHeader as every other standalone page (/profiel, /voorwaarden)
// and the real EventMarkerPreview component (not a redrawn approximation)
// so the marker sample always matches whatever the map actually renders.
export function OrganisatorenPage() {
  return (
    <div className={styles.page}>
      <PageHeader />
      <div className={styles.content}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Voor wie iets te vieren heeft in Tilburg</p>
            <h1>
              Sta op de kaart die Tilburg <span className={styles.accent}>toch al</span> open heeft staan.
            </h1>
            <p className={styles.lede}>
              2happies is de interactieve kaart met broodjeszaken en evenementen in Tilburg. Bezoekers
              gebruiken &apos;m om te beslissen wat ze vandaag gaan doen &mdash; met jouw evenement erop,
              met foto, tijden en locatie, vinden ze jou vanzelf.
            </p>
            <div className={styles.ctaRow}>
              <a className={styles.btnPrimary} href={CONTACT_MAILTO}>
                Meld je evenement aan
              </a>
              <a className={styles.btnGhost} href="#hoe-het-werkt">
                Bekijk hoe het werkt
              </a>
            </div>
          </div>
          <div className={styles.markerStage}>
            <EventMarkerPreview category="muziek" />
          </div>
        </section>

        <div className={styles.section} id="hoe-het-werkt">
          <p className={styles.eyebrow}>Wat je krijgt</p>
          <h2>Geen advertentie. Een pin op de route die mensen al lopen.</h2>
          <p className={styles.intro}>
            Niemand scrollt langs 2happies toevallig voorbij &mdash; bezoekers openen de kaart gericht,
            op zoek naar iets te doen of te eten in Tilburg. Daar zet je je evenement neer.
          </p>
          <div className={styles.cards}>
            <div className={styles.card}>
              <h3>Mensen die al zoeken</h3>
              <p>
                Geen koude advertentie tussen ruis. Iedereen die je evenement ziet, had de kaart al open
                om te beslissen wat ze vandaag in Tilburg gaan doen.
              </p>
            </div>
            <div className={styles.card}>
              <h3>Je eigen pin, precies zo</h3>
              <p>
                Foto, categorie en tijden op de kaart &mdash; en je ziet vooraf exact hoe je marker
                eruitziet, voordat je &apos;m live zet.
              </p>
            </div>
            <div className={styles.card}>
              <h3>Onderdeel van iets groters</h3>
              <p>
                Hoort je evenement bij een groter evenement in de stad? Koppel &apos;m eraan en deel mee
                in die zichtbaarheid.
              </p>
            </div>
            <div className={styles.card}>
              <h3>Zelf aan het stuur</h3>
              <p>
                Bewerk, dupliceer of zet je evenement stop wanneer je wilt, vanuit je eigen omgeving
                &mdash; geen mail sturen naar een beheerder.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles.eyebrow}>Wat is ervoor nodig</p>
          <h2>Drie stappen, geen papierwerk.</h2>
          <p className={styles.intro}>
            Geen contract, geen KVK-koppeling &mdash; je verklaart zelf dat je namens het bedrijf handelt
            en kunt binnen een paar minuten live staan.
          </p>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <div>
                <h3>Account, zonder gedoe</h3>
                <p>
                  Aanmelden met e-mail of Google. Geen KVK-verificatie &mdash; je verklaart zelf bevoegd
                  te zijn om namens het bedrijf te handelen.
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <div>
                <h3>Vul je evenement in</h3>
                <p>
                  Titel, beschrijving, datum(s) en tijd, categorie en locatie. Voeg optioneel een
                  staande foto (3:4) en toegangsprijzen toe.
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <div>
                <h3>Live</h3>
                <p>
                  Eenmalig &euro;10,- (excl. btw) en je evenement staat direct op de kaart &mdash; geen
                  wachttijd op goedkeuring vooraf.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles.eyebrow}>Praktisch</p>
          <h2>Eerlijk en overzichtelijk.</h2>
          <div className={styles.facts}>
            <span className={styles.priceBadge}>&euro;10,- excl. btw (&euro;12,10 incl.)</span>
            <ul>
              <li>
                <strong>Eenmalig</strong> per evenement &mdash; geen abonnement, geen verborgen kosten.
              </li>
              <li>
                <strong>Geen KVK-koppeling nodig</strong> &mdash; snel en zelf te regelen.
              </li>
              <li>
                <strong>Direct live</strong> &mdash; we controleren achteraf steekproefsgewijs, en
                bezoekers kunnen een evenement melden. Jij hoeft niet te wachten op goedkeuring.
              </li>
            </ul>
          </div>
        </div>

        <section className={styles.closing}>
          <h2>Klaar om erbij te staan?</h2>
          <p>Stuur ons een bericht en we helpen je evenement op de kaart te zetten.</p>
          <div className={styles.ctaRow}>
            <a className={styles.btnPrimary} href={CONTACT_MAILTO}>
              Meld je evenement aan
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
