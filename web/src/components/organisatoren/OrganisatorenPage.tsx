"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/common/PageHeader";
import { EventMarkerPreview } from "@/components/map/EventMarkerPreview";
import { AuthModal } from "@/components/auth/AuthModal";
import { PostAuthFlow } from "@/components/auth/PostAuthFlow";
import type { Visitor } from "@/types/account";
import styles from "./OrganisatorenPage.module.css";

type PostAuthStep = "onboarding" | "chooser" | "createBusiness";

// Marketing/explainer page for prospective event organizers — "what do we
// offer, what does it cost, what do you need to get started". Reuses the
// same PageHeader as every other standalone page (/profiel, /voorwaarden)
// and the real EventMarkerPreview component (not a redrawn approximation)
// so the marker sample always matches whatever the map actually renders.
//
// The CTA wires into the same AuthModal/PostAuthFlow machinery
// AccountMenu.tsx uses for "Event-profiel aanmaken" — but skips
// RoleChoiceModal's generic visitor/event-host chooser entirely: anyone
// clicking a button on this specific page has already declared that intent
// by being here, so businessIntent is unconditionally true (unlike
// AccountMenu, where it depends on which RoleChoiceModal button was picked).
export function OrganisatorenPage() {
  const router = useRouter();
  const { currentVisitor, currentBusiness } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [postAuth, setPostAuth] = useState<PostAuthStep | null>(null);

  function goToBusiness() {
    router.push("/eventbeheer");
  }

  function handleCta() {
    if (currentBusiness) {
      goToBusiness();
    } else if (currentVisitor) {
      // Already signed in, just no event profile yet — AuthModal would be
      // redundant, go straight to the create-business step.
      setPostAuth("createBusiness");
    } else {
      setAuthOpen(true);
    }
  }

  function handleAuthenticated(visitor: Visitor) {
    const isNewAccount = visitor.marketingConsentAt === undefined;
    setPostAuth(isNewAccount ? "onboarding" : "chooser");
  }

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
              <button type="button" className={styles.btnPrimary} onClick={handleCta}>
                Meld je evenement aan
              </button>
              <a className={styles.btnGhost} href="#hoe-het-werkt">
                Bekijk hoe het werkt
              </a>
            </div>
          </div>
          <div className={styles.markerStage}>
            <EventMarkerPreview category="muziek" />
          </div>
        </section>

        <div className={styles.section}>
          <p className={styles.eyebrow}>Het ontstaan</p>
          <h2>Begonnen als een TikTok-serie, uitgegroeid tot dé broodjeskaart van Tilburg.</h2>
          <p className={styles.intro}>
            2happies ontstond uit de virale Instagram- en TikTok-serie van Tilburger Bastiaan, die de
            stad afstruint op zoek naar de beste broodjeszaken. De kaart die daarbij hoort trekt
            inmiddels duizenden bezoekers.
          </p>
          <p className={styles.intro}>
            Die aandacht maakte de volgende stap voor de hand liggend: dezelfde kaart gebruiken om
            Tilburgers ook moeiteloos lokale events te laten vinden. Bestaande evenementenplatforms zijn
            vaak duur en onoverzichtelijk &mdash; 2happies lost dat op met een laagdrempelige, goedkope
            interactieve kaart, die het ook voor een kleine organisator mogelijk maakt om een evenement
            voor een groot publiek zichtbaar te maken.
          </p>
        </div>

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
            <div className={styles.card}>
              <h3>Precies zien of het je iets oplevert</h3>
              <p>
                Je dashboard toont per evenement hoeveel mensen &apos;m bekeken, doorklikten naar je
                website, interesse toonden en deelden &mdash; zodat je meteen weet of 2happies het waard
                was.
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
          <p>Maak een gratis account en zet je eerste evenement binnen een paar minuten op de kaart.</p>
          <div className={styles.ctaRow}>
            <button type="button" className={styles.btnPrimary} onClick={handleCta}>
              Meld je evenement aan
            </button>
          </div>
        </section>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={handleAuthenticated} />
      <PostAuthFlow
        open={postAuth !== null}
        onClose={() => setPostAuth(null)}
        startStep={postAuth ?? "chooser"}
        businessIntent
        onOpenProfile={() => router.push("/profiel")}
        onGoToBusiness={goToBusiness}
      />
    </div>
  );
}
