import { LegalPage, Placeholder } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Voorwaarden — 2happies",
};

export default function VoorwaardenPage() {
  return (
    <LegalPage title="Algemene voorwaarden" lastUpdated="3 september 2026">
      <h2>1. Wie we zijn</h2>
      <p>
        2happies (2happies.nl) is een kaart met broodjeszaken en events in Tilburg. 2happies wordt
        aangeboden door <Placeholder>volledige bedrijfsnaam</Placeholder>, ingeschreven bij de Kamer
        van Koophandel onder nummer <Placeholder>KVK-nummer</Placeholder>, gevestigd op{" "}
        <Placeholder>vestigingsadres</Placeholder>, BTW-nummer <Placeholder>BTW-nummer</Placeholder>{" "}
        (&quot;2happies&quot;, &quot;we&quot;, &quot;wij&quot;). Vragen? Neem contact op via{" "}
        <Placeholder>contact-e-mailadres</Placeholder>.
      </p>
      <p>
        Door 2happies te gebruiken ga je akkoord met deze voorwaarden. Onderdeel 3 hieronder geldt
        specifiek voor bedrijven/event-hosts die een betaalde evenementvermelding plaatsen — de
        rest geldt voor iedereen.
      </p>

      <h2>2. De dienst</h2>
      <p>
        2happies toont broodjeszaken en events in en rond Tilburg op een kaart, met ratings,
        reviews, foto&apos;s en filters. Een account is niet verplicht om de kaart te bekijken.
        Een gratis bezoekersaccount (e-mailadres + wachtwoord, of &quot;Doorgaan met Google&quot;)
        geeft toegang tot likes, ratings, reacties, reviews en het bewaren van events. Een
        event-profiel (bovenop een account) geeft de mogelijkheid om zelf evenementen te
        plaatsen tegen betaling — zie onderdeel 3.
      </p>
      <p>
        We proberen de dienst zo goed mogelijk beschikbaar te houden, maar geven geen garantie op
        ononderbroken beschikbaarheid. Onderhoud, storingen bij onze leveranciers (Firebase/Google,
        Stripe) of overmacht kunnen de dienst tijdelijk onbeschikbaar maken.
      </p>

      <h3>Minimumleeftijd</h3>
      <p>
        Het bekijken van de kaart zonder account kan op elke leeftijd. Voor het aanmaken van een
        account moet je 16 jaar of ouder zijn — dit is de leeftijdsgrens die de AVG in Nederland
        stelt voor toestemming voor diensten van de informatiemaatschappij zonder ouderlijke
        toestemming.
      </p>

      <h2>3. Gebruikersinhoud (ratings, reacties, reviews)</h2>
      <p>
        Ratings, reacties en reviews die je op 2happies plaatst zijn jouw persoonlijke mening, geen
        geverifieerde feiten en niet het standpunt van 2happies. We modereren niet vooraf — content
        is direct zichtbaar zodra je hem plaatst.
      </p>
      <p>
        <strong>Voor bedrijven die het niet eens zijn met een review:</strong> gebruik de
        &quot;Melden&quot;-knop op de betreffende review, rating of reactie. Een melding komt
        terecht bij onze admins, die de inhoud kunnen verwijderen (permanent) of tijdelijk
        verbergen als deze in strijd is met deze voorwaarden (bijvoorbeeld: duidelijk onwaar,
        beledigend, of niet over de daadwerkelijke ervaring bij de zaak in kwestie). We beoordelen
        elke melding op zijn merites — een melding leidt niet automatisch tot verwijdering.
      </p>
      <p>
        Je bent zelf verantwoordelijk voor wat je plaatst. Content die lasterlijk, discriminerend,
        illegaal is, of inbreuk maakt op rechten van anderen is niet toegestaan en kan zonder
        voorafgaande waarschuwing worden verwijderd; bij herhaling kan een account worden
        geblokkeerd.
      </p>

      <h2>4. Melden van content &amp; notice-and-takedown</h2>
      <p>
        Elke shop, elk event, elke reactie en elke review op 2happies is te melden via de
        &quot;Melden&quot;-knop — ook zonder account. Een melding wordt beoordeeld door een admin,
        die de content kan laten staan, tijdelijk verbergen (&quot;suspend&quot;, omkeerbaar), of
        permanent verwijderen/blokkeren. Denk je dat content op 2happies je rechten schendt (bijv.
        auteursrecht op een foto, of een lasterlijke review) — meld het via de knop op de content
        zelf, of neem contact op via <Placeholder>contact-e-mailadres</Placeholder> als de
        meldknop niet volstaat. We reageren op elke melding; hoe snel hangt af van de aard van de
        melding.
      </p>

      <h2>5. Voor bedrijven &amp; event-hosts: evenementvermeldingen</h2>
      <h3>5.1 Kosten</h3>
      <p>
        Het plaatsen van een evenement kost een eenmalig bedrag van <strong>€10</strong> per
        evenement, inclusief BTW, te betalen via Stripe (iDEAL of creditcard). Dit bedrag wordt
        getoond voordat je op &quot;Opslaan&quot; klikt. Na een geslaagde betaling ontvang je een
        digitale factuur/kwitantie van Stripe.
      </p>
      <h3>5.2 Directe publicatie</h3>
      <p>
        Een evenement gaat automatisch live op de kaart zodra de betaling is bevestigd — er is
        geen aparte goedkeuringsstap vooraf. Achteraf kan een admin een evenement wel tijdelijk
        verbergen (&quot;suspend&quot;, omkeerbaar) of permanent verwijderen (&quot;block&quot;) als
        het na een melding in strijd blijkt met deze voorwaarden. In dat geval geldt de
        annulerings- en restitutieregeling hieronder.
      </p>
      <h3>5.3 Wijzigen en annuleren</h3>
      <p>
        Zolang een evenement nog niet betaald is (status &quot;pending&quot;), kun je het vrij
        wijzigen of verwijderen. Na betaling liggen titel, datum en locatie vast (je kunt ze niet
        meer wijzigen — dit voorkomt dat een betaalde, live vermelding achteraf naar iets anders
        verandert); beschrijving, foto, prijzen en website-link blijven wel aanpasbaar.
      </p>
      <h3>5.4 Restitutiebeleid</h3>
      <p>
        Omdat een evenement direct live gaat zodra betaald is, geldt: <strong>geen restitutie</strong>{" "}
        nadat een evenement succesvol gepubliceerd is — je hebt op dat moment gekregen waarvoor je
        betaald hebt (een live plaatsing op de kaart). Uitzonderingen waarin we wel restitueren,
        naar eigen beoordeling:
      </p>
      <ul>
        <li>
          De betaling is gelukt, maar het evenement is door een technische fout bij 2happies nooit
          live gegaan.
        </li>
        <li>
          Een admin verwijdert je evenement na een melding, terwijl het naar ons oordeel
          onterecht was gemeld en de content niet in strijd was met deze voorwaarden.
        </li>
      </ul>
      <p>
        Neem voor een restitutieverzoek contact op via{" "}
        <Placeholder>contact-e-mailadres</Placeholder> met je evenementnaam en betaalbevestiging.
        We behandelen elk verzoek individueel.
      </p>
      <h3>5.5 Wat als je je account verwijdert?</h3>
      <p>
        Als je je event-profiel verwijdert, worden al je evenementen (ook betaalde, live
        evenementen) samen met het account verwijderd. Dit geldt ook voor een lopend, betaald
        evenement — er volgt in dat geval geen automatische restitutie voor de resterende
        looptijd. Overweeg dit voordat je een account met actieve evenementen verwijdert.
      </p>
      <h3>5.6 Eigendom van geplaatste content</h3>
      <p>
        Je blijft eigenaar van de teksten en foto&apos;s die je voor je evenement aanlevert. Door
        ze te plaatsen geef je 2happies een niet-exclusieve licentie om ze te tonen op de kaart,
        in zoekresultaten en (voor foto&apos;s) in verkleinde/verwerkte vorm (thumbnail/detail-
        varianten) voor weergave op verschillende schermformaten.
      </p>
      <h3>5.7 Identiteitsverificatie</h3>
      <p>
        We verifiëren op dit moment niet actief of een event-host daadwerkelijk bevoegd is om
        namens het genoemde bedrijf te handelen (geen KVK-koppeling). We behouden ons het recht
        voor dit in de toekomst wel te doen. Meld een vermoede valse vermelding via de
        &quot;Melden&quot;-knop.
      </p>

      <h2>6. Aansprakelijkheid</h2>
      <p>
        2happies is een platform dat informatie van bedrijven en gebruikers doorgeeft — we
        verifiëren niet zelf de juistheid van openingstijden, menu&apos;s, prijzen of
        evenementdetails. We zijn niet aansprakelijk voor schade die voortvloeit uit het gebruik
        van onjuiste of verouderde informatie op de kaart, tenzij sprake is van opzet of grove
        nalatigheid van onze kant. Onze aansprakelijkheid is in alle gevallen beperkt tot het
        bedrag dat je in de voorgaande 12 maanden aan ons betaald hebt (voor de meeste gebruikers
        dus €0).
      </p>

      <h2>7. Wijzigingen</h2>
      <p>
        We kunnen deze voorwaarden aanpassen. Bij een wezenlijke wijziging informeren we
        geregistreerde gebruikers (bijvoorbeeld via een melding in de app). De datum bovenaan deze
        pagina geeft aan wanneer de voorwaarden voor het laatst zijn bijgewerkt.
      </p>

      <h2>8. Toepasselijk recht</h2>
      <p>Op deze voorwaarden is Nederlands recht van toepassing.</p>
    </LegalPage>
  );
}
