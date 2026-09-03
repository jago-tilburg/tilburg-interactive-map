import { LegalPage, Placeholder } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Privacybeleid — 2happies",
};

export default function PrivacybeleidPage() {
  return (
    <LegalPage title="Privacybeleid" lastUpdated="3 september 2026">
      <p>
        2happies (2happies.nl, Bastiaanson, KVK 65871421, BTW-nummer NL002308042B51) is
        verwerkingsverantwoordelijke voor de persoonsgegevens beschreven in dit beleid. Vragen of
        verzoeken over je gegevens: 2happies@bastiaanson.com.
      </p>

      <h2>1. Welke gegevens we verwerken</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border, #e7e0d6)" }}>
            <th style={{ padding: "0.5rem 0.5rem 0.5rem 0" }}>Gegevens</th>
            <th style={{ padding: "0.5rem 0.5rem 0.5rem 0" }}>Waarvoor</th>
            <th style={{ padding: "0.5rem 0 0.5rem 0" }}>Grondslag</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["E-mailadres, weergavenaam (bezoekersaccount)", "Inloggen, likes/ratings/reacties koppelen aan je account", "Overeenkomst (art. 6(1)(b) AVG)"],
            ["Organisatienaam, e-mailadres (event-profiel)", "Evenementen namens een bedrijf plaatsen en beheren", "Overeenkomst"],
            ["Wachtwoord (versleuteld door Firebase Auth)", "Inloggen", "Overeenkomst"],
            ["Google-naam en -e-mailadres (bij \"Doorgaan met Google\")", "Inloggen zonder wachtwoord", "Overeenkomst"],
            ["Marketingtoestemming (aan/uit + tijdstip)", "Onthouden of je marketing-e-mail wilt ontvangen", "Toestemming (art. 6(1)(a)) — apart van accountregistratie, elk moment intrekbaar"],
            ["Likes, ratings, reacties, reviews op shops", "De functie zelf; gekoppeld aan je account (ingelogd) of een willekeurig lokaal ID (niet ingelogd)", "Overeenkomst / gerechtvaardigd belang (functionaliteit zonder account)"],
            ["Bewaarde evenementen", "De \"bewaren\"-functie", "Overeenkomst"],
            ["Evenementgegevens (titel, locatie, datum, prijzen, foto)", "Publicatie op de kaart", "Overeenkomst"],
            ["Betaalgegevens", "Verwerkt volledig door Stripe — 2happies ziet zelf nooit kaartgegevens, alleen de betaalstatus", "Overeenkomst"],
            ["IP-adres (via hostinglogs)", "Beveiliging, misbruikdetectie", "Gerechtvaardigd belang"],
            ["Gebruiksstatistieken (aantal weergaven/klikken per shop/event)", "Inzicht voor bedrijven in hun eigen vermelding", "Gerechtvaardigd belang — niet aan een persoon te koppelen"],
            ["Google Analytics-gegevens (alleen als je hiervoor toestemming geeft)", "Zien welke onderdelen van de app gebruikt worden, waar bezoekers afhaken", "Toestemming — wordt pas geladen ná jouw akkoord in de cookiemelding"],
          ].map(([what, why, basis]) => (
            <tr key={what} style={{ borderBottom: "1px solid var(--color-border, #e7e0d6)" }}>
              <td style={{ padding: "0.5rem 0.5rem 0.5rem 0", verticalAlign: "top" }}>{what}</td>
              <td style={{ padding: "0.5rem 0.5rem 0.5rem 0", verticalAlign: "top" }}>{why}</td>
              <td style={{ padding: "0.5rem 0 0.5rem 0", verticalAlign: "top" }}>{basis}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>2. Bewaartermijnen</h2>
      <ul>
        <li>
          <strong>Accountgegevens</strong> (bezoeker en/of event-profiel): zolang je account
          bestaat. Verwijder je je account, dan verwijderen we direct je profiel, je evenementen,
          en je koppeling aan likes/ratings/reacties/reviews (self-service, via &quot;Account
          verwijderen&quot; in je accountmenu — geen wachttijd, geen handmatige aanvraag nodig).
        </li>
        <li>
          <strong>Betaalgegevens</strong>: bewaard door Stripe volgens hun eigen bewaartermijnen
          (wettelijk verplicht voor facturatie/boekhouding, doorgaans 7 jaar) — wij bewaren zelf
          alleen de betaalstatus en een Stripe-sessiereferentie, geen kaartgegevens.
        </li>
        <li>
          <strong>Firestore-back-ups</strong>: dagelijkse back-ups, 7 dagen bewaard, daarna
          automatisch verwijderd.
        </li>
        <li>
          <strong>Anonieme interacties</strong> (likes/ratings van niet-ingelogde bezoekers): tot
          de betreffende shop verwijderd wordt of de browser-lokale opslag gewist wordt door de
          bezoeker zelf.
        </li>
      </ul>

      <h2>3. Jouw rechten</h2>
      <p>Onder de AVG heb je het recht op:</p>
      <ul>
        <li><strong>Inzage</strong> — welke gegevens we van je hebben.</li>
        <li><strong>Rectificatie</strong> — onjuiste gegevens laten corrigeren.</li>
        <li>
          <strong>Verwijdering</strong> — je account en alle bijbehorende gegevens zelf
          verwijderen via &quot;Account verwijderen&quot; in je accountmenu, direct effectief.
        </li>
        <li>
          <strong>Dataportabiliteit</strong> — je gegevens in een overdraagbaar formaat opvragen.
        </li>
        <li><strong>Bezwaar</strong> — bezwaar maken tegen verwerking op basis van gerechtvaardigd belang.</li>
        <li><strong>Intrekken van toestemming</strong> — marketingtoestemming en analytics-toestemming kun je op elk moment intrekken (marketing: in je profiel; analytics: bij een volgend bezoek via de cookiemelding).</li>
      </ul>
      <p>
        Voor verzoeken die je niet zelf via de app kunt regelen: neem contact op via
        2happies@bastiaanson.com. Je hebt ook het recht een klacht in te dienen bij de Autoriteit
        Persoonsgegevens.
      </p>

      <h2>4. Cookies &amp; lokale opslag</h2>
      <p>
        We gebruiken <code>localStorage</code> (geen traditionele cookies) voor:
      </p>
      <ul>
        <li>
          <strong>Functioneel noodzakelijk</strong> (geen toestemming vereist): een willekeurig
          lokaal ID voor likes/ratings/reacties zonder account; of je de cookiemelding al gezien
          hebt.
        </li>
        <li>
          <strong>Alleen met jouw toestemming</strong>: Google Analytics — de bijbehorende script
          wordt pas geladen nadat je in de cookiemelding op &quot;Accepteren&quot; klikt (niet bij
          &quot;Alleen noodzakelijk&quot;). Je kunt je keuze op elk moment wijzigen door je
          lokale opslag te wissen, waarna de melding opnieuw verschijnt.
        </li>
      </ul>

      <h2>5. Derde partijen</h2>
      <ul>
        <li>
          <strong>Firebase/Google Cloud (Europa, region europe-west1/west4)</strong> — hosting,
          authenticatie, database, foto-opslag. Google is subverwerker; een
          verwerkersovereenkomst met Google Cloud is <Placeholder>wel/niet geaccepteerd — controleren</Placeholder>.
        </li>
        <li>
          <strong>Google Maps Platform</strong> — voor het tonen van de kaart. Zie Google&apos;s
          eigen privacybeleid voor hoe zij kaartverzoeken verwerken.
        </li>
        <li>
          <strong>Stripe</strong> — betalingsverwerking voor evenementvermeldingen. 2happies
          ontvangt nooit kaartgegevens zelf. Zie Stripe&apos;s eigen privacybeleid.
        </li>
        <li>
          <strong>Resend</strong> — verzending van transactionele e-mail (e-mailverificatie,
          wachtwoord-reset, betaalbevestiging).
        </li>
        <li>
          <strong>Google Analytics</strong> (alleen als je toestemming geeft) — geanonimiseerde
          gebruiksstatistieken.
        </li>
        <li>
          <strong>Instagram-embeds</strong> — als een shop een Instagram-link heeft, kan een
          embed van Instagram/Meta geladen worden op de detailpagina van die shop.
        </li>
      </ul>
      <p>Alle bovenstaande partijen zijn gevestigd in of bieden AVG-passende waarborgen voor de EU.</p>

      <h2>6. Datalek</h2>
      <p>
        Bij een datalek dat een risico oplevert voor betrokkenen melden we dit binnen 72 uur bij
        de Autoriteit Persoonsgegevens, conform de AVG. Betrokkenen worden geïnformeerd als het
        lek waarschijnlijk een hoog risico voor hun rechten en vrijheden oplevert.
      </p>

      <h2>7. Wijzigingen</h2>
      <p>
        We kunnen dit privacybeleid aanpassen. De datum bovenaan deze pagina geeft aan wanneer het
        voor het laatst is bijgewerkt.
      </p>
    </LegalPage>
  );
}
