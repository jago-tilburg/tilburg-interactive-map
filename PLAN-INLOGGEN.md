# Plan — Inloggen herbouwen (wachtwoord + Google, dubbele rol, bedrijfsomgeving)

Branch: **`staging-next`**. Niets van dit plan raakt `main`/prod.
Opgesteld 2026-08-26. Herzien op dezelfde dag: de e-mail-code-flow is vervangen door
wachtwoord + Google — zie §1 voor waarom.

---

## 0. Vastgelegde keuzes

| Onderwerp | Keuze |
|---|---|
| Inlogmethode | **E-mail + wachtwoord**, plus **Doorgaan met Google** |
| Wachtwoord vergeten | `sendPasswordResetEmail` — Firebase verstuurt de mail zelf |
| Mailprovider | **Geen.** Geen Resend, geen DNS, geen eigen Functions. |
| Admin | Logt in via hetzelfde scherm. Admin-zijn blijft `admins/{uid}` in Firestore. |
| Dubbele rol | **Één account.** Bezoekersprofiel is de basis; event-profiel is een aanvulling op hetzelfde account. |
| Na inloggen | **Keuzescherm**: 1) de kaart, 2) bezoekersprofiel, 3) event-profiel |
| Bezoekersprofiel | Blijft een **venster over de kaart** — geen aparte pagina |
| Bedrijfsomgeving | **Schermvullende pagina** `/bedrijf` met tabs: Inzicht / Nieuw event / Profiel |
| Inzicht-tab | Statistiekkaarten bovenaan, eigen eventlijst eronder |
| Nieuw-event-tab | Formulier **direct op de pagina**, geen venster |
| Marketingtoestemming | Aan **iedereen** gevraagd bij de eerste keer inloggen |
| Magic link | Gaat eruit — één inlogflow voor iedereen |

### Aanname die ik zelf heb ingevuld
Op het keuzescherm staat de derde knop er **altijd**. Heb je nog geen event-profiel, dan leest
die "Event-profiel aanmaken" en vraagt hij om je bedrijfsnaam. Zo is de upgrade van bezoeker
naar event owner altijd één klik weg, precies het punt van "zowel bezoeker als event owner
kunnen zijn". Zeg het als je liever alleen de knoppen ziet die je al hebt.

---

## 1. Waarom wachtwoord en geen e-mailcode

Firebase Auth kan **geen e-mailcodes**. Een code die de gebruiker zelf intypt zou twee eigen
Cloud Functions vergen, een Resend-account met SPF/DKIM/DMARC op 2happies.nl, rate limiting,
code-hashing en een TTL-policy — en dan staat **mailbezorging op het kritieke pad van elke
inlog**. Loopt dat vast of belandt de mail in spam, dan kan niemand meer inloggen, jij als admin
inbegrepen.

Wachtwoord + Google is native Firebase, staat al half in de code (`loginBusiness` en
`registerBusiness` in `web/src/lib/firebase/auth.ts:47-53`), en mail raakt alleen het
vergeten-pad. Google vangt bovendien een flink deel van de gebruikers op die dan nooit een
wachtwoord aanraken.

De prijs, eerlijk benoemd: registreren en inloggen blijven twee aparte standen in plaats van
samen te vallen, en op mobiel is een wachtwoord meer werk dan een code overtypen. Codes kunnen
er later bovenop, als extra provider naast deze — dat is geen verbouwing van dit plan.

**Wat dit plan wél houdt** en waar de eigenlijke waarde zit: de dubbele rol, het keuzescherm,
de marketingtoestemming, de login7-layout en de schermvullende `/bedrijf`-omgeving. Die stonden
los van de inlogmethode.

---

## 2. Waarom dit nog steeds geen kleine ingreep is

**Bezoeker en bedrijf sluiten elkaar nu structureel uit.** `web/src/hooks/useAuth.tsx:110`
doet letterlijk:

```ts
const biz = await getBusinessProfile(user.uid);
if (biz) { setCurrentBusiness(biz); setCurrentVisitor(null); }
else { ...; setCurrentVisitor(visitor); setCurrentBusiness(null); }
```

Eén van de twee is altijd `null`. Dat moet eruit voordat één account beide kan zijn. Datzelfde
blok behandelt `isAdmin` als dezelfde soort uitsluitende toestand (regel 100-105) — die gaat om
dezelfde reden om.

---

## 3. Datamodel

Er komt **geen enkele nieuwe collectie** bij. Alleen `visitors/{uid}` groeit:

```ts
export interface Visitor {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
  savedEventIds?: string[];
  marketingConsent?: boolean;                      // NIEUW
  marketingConsentAt?: Timestamp;                  // NIEUW — gegeven óf ingetrokken
  marketingConsentSource?: "signup" | "profile";   // NIEUW
}
```

`businesses/{uid}` verandert niet van vorm. Wat verandert is *wanneer* het bestaat: niet meer
bij registratie, maar op het moment dat iemand een event-profiel aanmaakt. Het `Business`-type
in `web/src/types/account.ts` blijft precies zoals het is.

### GDPR-punten bij die toestemming
- Standaard **uitgevinkt**. Een voorgevinkt vakje is geen geldige toestemming.
- **Los** van "ik accepteer de voorwaarden" — nooit één vinkje voor beide.
- **Intrekbaar** met dezelfde moeite als geven: een schakelaar in het bezoekersprofiel.
- `PrivacyModal.tsx` bijwerken: waarvoor het adres gebruikt wordt.
- Optioneel, voor echte auditeerbaarheid: een `consentLog`-subcollectie die elke wijziging
  bijhoudt in plaats van alleen de laatste stand. Nu overkill, maar noem het als je ooit een
  klacht moet kunnen navertellen.

### Eén ding dat je met wachtwoorden erbij krijgt: onbevestigde adressen
Bij een code-inlog wás het adres bewezen — je had de code immers. Bij wachtwoordregistratie is
`emailVerified` **onwaar**, en dan zit je met een marketingtoestemming op een adres dat niemand
heeft bevestigd. Voorstel: bij registratie `sendEmailVerification` sturen (Firebase doet dat
zelf), het gebruik van de app er **niet** op blokkeren, maar in een toekomstige mailinglijst
alleen bevestigde adressen meenemen. Google-gebruikers zijn per definitie al bevestigd.

---

## 4. Backend

**Niets.** Geen nieuwe Cloud Functions, geen nieuwe dependencies in `functions/package.json`,
geen secrets. `createCheckoutSession` en `stripeWebhook` hangen aan `request.auth.uid` en werken
onveranderd.

---

## 5. Firestore rules

Alleen `visitors/{uid}`, waar de create-regel een typecheck op het nieuwe veld krijgt:

```
&& (!('marketingConsent' in request.resource.data)
    || request.resource.data.marketingConsent is bool)
```

`businesses/{uid}` hoeft niet aangepast: die regel eist alleen dat `uid` klopt en is dus al
geschikt voor "later aangemaakt op een bestaand account".

---

## 6. Client — de authenticatielaag

### `web/src/lib/firebase/auth.ts`

**Erbij:**
- `signInWithGoogle()` — popup, met redirect als terugval
- `sendPasswordReset(email)` — `sendPasswordResetEmail`
- `sendVerificationEmail(user)` — `sendEmailVerification`

**Omgedoopt:**
- `loginBusiness` → `signInWithPassword` — het is geen bedrijfsdinges meer, het is *de* inlog
- `registerBusiness` → `registerWithPassword`
- `changeBusinessPassword` → `changeAccountPassword` — een wachtwoord hangt aan het account,
  niet aan een rol. Verhuist naar het bezoekersprofiel; de reauthenticatie-dans erin blijft
  ongewijzigd nodig.

**Eruit:** `visitorActionCodeSettings`, `sendVisitorMagicLink`, `isVisitorMagicLink`,
`completeVisitorMagicLink`, `VISITOR_AUTH_EMAIL_KEY`, `loginAdmin` (dat was een duplicaat van
`loginBusiness` met een andere naam).

### `web/src/hooks/useAuth.tsx`
De kern van de dubbele rol. Het `if (biz) … else …` wordt:

```ts
const [biz, visitor] = await Promise.all([
  getBusinessProfile(user.uid),
  getVisitorProfile(user.uid),
]);
setCurrentBusiness(biz);                                  // mag samen met
setCurrentVisitor(visitor ?? await createVisitorProfile(user.uid, user.email ?? ""));
```

Drie gevolgen om bewust te accepteren:
- **Iedereen krijgt een bezoekersprofiel**, ook event owners en admins. Dat is het punt van het
  model: het bezoekersprofiel *is* je account.
- `isAdmin` wordt **aanvullend** in plaats van uitsluitend — de short-circuit op regel 100-105
  gaat eruit.
- De magic-link-afhandeling in het eerste `useEffect` (regel 60-77) verdwijnt, inclusief die
  `window.prompt("Bevestig je e-mailadres")`.

`suppressAutoProfileLoadRef` **blijft nodig** — anders dan in de code-variant. Bij
wachtwoordregistratie logt de client zichzelf in vóórdat het profiel bestaat, dus de race die
dat ref-veld afdekt (uitvoerig beschreven op `useAuth.tsx:38-44` en
`BusinessAuthModal.tsx:88-98`) blijft echt bestaan. Niet weghalen.

Erbij in de context: `refreshCurrentVisitor` naast de bestaande `refreshCurrentBusiness`, en
`needsOnboarding` — waar of onwaar op basis van "heeft dit bezoekersprofiel al een
`marketingConsent`-veld".

---

## 7. Het inlogscherm (login7-layout)

login7 is een **betaald block** van shadcnblocks, gebouwd op shadcn/ui + Tailwind. Dit project
heeft shadcn bewust afgewezen (te Tailwind-gebonden) en gebruikt Radix-primitives met CSS
Modules. We bouwen dus de **layout** na in CSS Modules; we importeren hun code niet. Dat is
zowel technisch nodig als licentietechnisch de schone route.

Fijne bijkomstigheid van deze koerswijziging: login7 heeft van zichzelf een e-mailveld, een
wachtwoordveld en een Google-knop. De layout past nu **precies**, zonder een veld te hoeven
vervangen.

| login7 | Bij ons |
|---|---|
| Gecentreerde card, max 380px, rand zonder schaduw | idem |
| Logo + merknaam in de header | 2happies-logo + "2happies" |
| Google-knop (outline) | "Doorgaan met Google" |
| "OR"-divider | "of" |
| E-mailveld | idem |
| Wachtwoordveld | idem, met "Wachtwoord vergeten?" erachter |
| Full-width primary submit | "Inloggen" |
| "Nog geen account?"-link eronder | wisselt naar de registratiestand |

Drie standen in één component:
- **inloggen** — e-mail, wachtwoord, Google, plus de vergeten-link
- **registreren** — e-mail, wachtwoord (min. 8 tekens, strenger dan Firebase's 6), Google
- **wachtwoord vergeten** — alleen e-mail, dan "Check je inbox". Geef **dezelfde** melding of
  het adres bestaat of niet, anders is dit scherm een gratis account-checker.

Bewust géén bedrijfsnaam en géén displaynaam in de registratiestand: die horen bij de
onboarding-stap in §8. Reden is niet netheid maar noodzaak — wie via Google binnenkomt ziet
nooit een registratieformulier, dus alles wat je van een nieuwe gebruiker wil weten moet ná de
authenticatie gebeuren, anders bestaat het voor Google-gebruikers niet.

**Waar dit scherm leeft:** een venster over de kaart, zoals nu, geopend uit het accountmenu.
Consistent met "een profiel is een venster over de kaart", en je verliest je kaartpositie niet.

### Google-inloggen — drie dingen die stil kapot gaan als je ze overslaat
1. **CSP.** `next.config.ts` moet `https://apis.google.com` en `https://accounts.google.com` in
   `script-src`, en `https://<project>.firebaseapp.com` + `https://accounts.google.com` in
   `frame-src`. `connect-src` staat al op `https:` en is dekkend.
2. **Safari en storage partitioning.** De standaard `authDomain` is
   `<project>.firebaseapp.com`, een ander domein dan 2happies.nl. Redirect-sign-in leunt daar op
   cross-site opslag, en dat knijpen browsers dicht. Oplossing: `authDomain` op een subdomein
   van 2happies.nl zetten en `/__/auth/handler` daar laten serveren. Popup eerst, redirect als
   terugval.
3. **Accountkoppeling.** Iemand registreert met wachtwoord en komt later terug via Google op
   hetzelfde adres. Met "één account per e-mailadres" aan — de standaard — hoort Firebase
   `google.com` aan diezelfde uid te hangen. Dít moet je live testen, niet aannemen: de
   foutvariant is `auth/account-exists-with-different-credential` en die wil je niet voor het
   eerst in productie zien.

---

## 8. Na het inloggen: onboarding en het keuzescherm

**Eerste keer** (geen `marketingConsent`-veld op het profiel):

```
  ┌──────────────────────────────┐
  │  Welkom bij 2happies         │
  │                              │
  │  Hoe mogen we je noemen?     │
  │  [ Jago                    ] │
  │                              │
  │  ☐ Houd me per e-mail op de  │
  │    hoogte van nieuwe events  │
  │    en acties.                │
  │    Je kunt dit altijd weer   │
  │    uitzetten in je profiel.  │
  │                              │
  │        [ Doorgaan ]          │
  └──────────────────────────────┘
```

Vinkje staat uit. Doorgaan mag ook zonder. Opgeslagen wordt de uitkomst *en* het moment
(`marketingConsentAt`), zodat je later kunt aantonen wanneer iemand ja zei. Bij een
Google-login is de naam voorgevuld uit `user.displayName`.

**Daarna, elke keer, het keuzescherm:**

```
  ┌──────────────────────────────┐
  │  Waar wil je naartoe?        │
  │                              │
  │  ┌────────────────────────┐  │
  │  │ 🗺️  De kaart           │  │  → venster sluit
  │  └────────────────────────┘  │
  │  ┌────────────────────────┐  │
  │  │ 👤  Mijn profiel       │  │  → bezoekersvenster
  │  └────────────────────────┘  │
  │  ┌────────────────────────┐  │
  │  │ 🏢  Event-profiel      │  │  → /bedrijf
  │  └────────────────────────┘  │     of eerst: bedrijfsnaam
  └──────────────────────────────┘
```

Heb je nog geen event-profiel, dan leest knop 3 "Event-profiel aanmaken" en vraagt hij eerst om
je bedrijfsnaam (`createBusinessProfile`, bestaat al) voordat hij je naar `/bedrijf` stuurt.

Dit is één component met drie standen (`onboarding` → `chooser` → `createBusiness`) in hetzelfde
venster als het inlogscherm. Geen route-gedoe, geen flits van de kaart ertussen.

---

## 9. `/bedrijf` — de schermvullende bedrijfsomgeving

Nieuwe route `web/src/app/bedrijf/page.tsx`. Geen kaart, geen mapheader.

```
  ┌────────────────────────────────────────┐
  │ 2happies              ← Naar de kaart  │
  ├────────────────────────────────────────┤
  │  Inzicht  │ Nieuw event │ Profiel      │
  ├────────────────────────────────────────┤
  │                                        │
  │   ┌────────┐ ┌────────┐ ┌────────┐    │
  │   │ 1.2k   │ │  340   │ │   87   │    │
  │   │ views  │ │ klikken│ │ shares │    │
  │   └────────┘ └────────┘ └────────┘    │
  │                                        │
  │   Mijn events        [alle ▾]          │
  │   ┌──────────────────────────────┐    │
  │   │ Zomerfeest          ● LIVE   │    │
  │   │ 12–14 sep · Muziek           │    │
  │   │ 👁 812  🔗 210  ❤ 44  📤 61   │    │
  │   │ [Bewerk][Dupliceer][Verwijder]│   │
  │   └──────────────────────────────┘    │
  └────────────────────────────────────────┘
```

Radix `Tabs` — al in gebruik in `BusinessDashboard.tsx:4`, dus geen nieuwe afhankelijkheid.
Tabstand in de URL (`/bedrijf?tab=nieuw`) zodat vernieuwen en de terug-knop werken.
De route moet zelf ook afgeschermd: geen bedrijfsprofiel → terug naar de kaart, want een
directe link naar `/bedrijf` mag geen leeg dashboard opleveren.

De 409 regels van `BusinessDashboard.tsx` worden opgesplitst:

| Nieuw bestand | Komt uit |
|---|---|
| `components/business/InsightsTab.tsx` | de totalen op regel 190-192 als kaarten, plus de eventlijst en al z'n acties |
| `components/business/NewEventTab.tsx` | dun omhulsel om het formulier |
| `components/business/BusinessProfileTab.tsx` | de settings-tab, minus het wachtwoordgedeelte |
| `components/business/BusinessShell.tsx` | tabs + header + "Naar de kaart" |

`BusinessDashboard.tsx` verdwijnt daarna.

### Het formulier uit z'n venster trekken
`BusinessEventFormModal.tsx` is 477 regels en wordt **ook door `AdminPanel.tsx:566` gebruikt** —
daar moet het een venster blijven. Dus splitsen, niet verhuizen:

- **nieuw** `components/events/BusinessEventForm.tsx` — alle velden en logica, zonder `Modal`
- `BusinessEventFormModal.tsx` wordt een dun `<Modal><BusinessEventForm/></Modal>`

Zo blijft `AdminPanel` letterlijk ongewijzigd en blijven de ~30 bestaande tests in
`tests/unit/components/events/BusinessEventFormModal.test.tsx` groen — die draaien tegen de
wrapper en merken de splitsing niet. `NewEventTab` gebruikt `BusinessEventForm` rechtstreeks.

Eén ding dat wél anders wordt: het formulier had "sluiten" als uitgang. Inline is er niets om te
sluiten, dus na opslaan springt de app naar de Inzicht-tab met een toast. `onClose` wordt
`onDone`.

### Profiel-tab
Bedrijfsnaam, standaardadres/lat/lng (bestaat al), plus:
- **eruit:** wachtwoord wijzigen — dat verhuist naar het bezoekersprofiel, want het hangt aan
  je account en niet aan deze rol
- **erbij:** het e-mailadres, alleen-lezen (dat ís je inlog)
- **erbij:** "Event-profiel verwijderen", die alleen `businesses/{uid}` en de eigen events
  opruimt en je bezoekersaccount laat staan. Nieuw, en volgt rechtstreeks uit het
  dubbele-rol-model: je rol opgeven is niet hetzelfde als je account opzeggen. Het bestaande
  `deleteBusinessAccountCascade` moet daarvoor gesplitst worden in "gooi de bedrijfskant weg" en
  "gooi het hele account weg".

---

## 10. Wat er verdwijnt

| Weg | Waarom |
|---|---|
| `auth/VisitorAuthModal.tsx` | opgeslokt door één inlogscherm |
| `auth/BusinessAuthModal.tsx` | idem |
| `auth/AdminLoginModal.tsx` | admin logt in via hetzelfde scherm |
| `auth/AccountChooserModal.tsx` | de rolkeuze is nu ná het inloggen, niet ervoor |
| `auth/BusinessDashboard.tsx` | wordt `/bedrijf` |
| magic-link-code in `auth.ts` + `useAuth.tsx` | één inlogflow |

Het accountmenu (`AccountMenu.tsx`) verliest z'n prioriteitsladder (admin > bedrijf > bezoeker >
uitgelogd) en wordt een lijst van alles wat je hébt: profiel, bewaarde events, en als je die
rollen hebt ook bedrijfsomgeving en adminpaneel.

---

## 11. Wat er met bestaande accounts gebeurt

Prod draait nog de oude monoliet op RTDB, dus er zijn **geen echte accounts** die dit raakt —
alleen testaccounts op staging.

- **Bestaande bedrijfsaccounts** (met wachtwoord) blijven gewoon werken. Geen migratie.
- **Bestaande bezoekersaccounts uit de magic-link-flow hebben geen wachtwoord.** Dat is het enige
  echte migratiepunt van dit plan. In theorie zet "wachtwoord vergeten" er een op — een
  magic-link-user valt onder dezelfde Email/Password-provider — maar **dat moet je live
  verifiëren voordat de magic link eruit gaat**, want als `sendPasswordResetEmail` op zo'n
  account `auth/user-not-found` teruggeeft, kunnen die accounts nergens meer bij. Terugvalpaden
  als het misgaat: die gebruikers via Google laten inloggen, of eenmalig een wachtwoord zetten
  met de Admin SDK. Het gaat om een handvol testaccounts, dus dit is klein — maar niet iets om
  aan te nemen.

---

## 12. Testen

**Unit (vitest, `web/tests/unit/`)**
- Inlogscherm: de drie standen, wisselen ertussen, foutmeldingen uit
  `businessAuthErrorMessage` (die functie is bruikbaar zoals hij is), en dat de
  vergeten-stand dezelfde melding geeft voor een bestaand en een onbekend adres
- Registreren: wachtwoord onder 8 tekens wordt geweigerd
- Onboarding: vinkje standaard uit; doorgaan zonder vinkje slaat `false` + tijdstip op;
  naam voorgevuld bij Google
- Keuzescherm: drie takken, en de "nog geen event-profiel"-variant
- `useAuth`: bezoeker én bedrijf tegelijk gevuld; admin krijgt óók een bezoekersprofiel
- `/bedrijf`: zonder bedrijfsprofiel word je weggestuurd
- `BusinessShell`: tabs wisselen, tabstand uit de URL
- `BusinessEventForm`: de bestaande modal-tests moeten **ongewijzigd** groen blijven

**Rules (`rules-tests/`)** — let op: `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"` nodig
- `visitors` create met, zonder, en met een niet-boolean `marketingConsent`
- `businesses` create op een uid die al een bezoekersprofiel heeft

**E2E (playwright)** — nu een stuk simpeler dan met codes: registreren en inloggen met
wachtwoord kan volledig geautomatiseerd, zonder testmodus of achterdeur in een Cloud Function.
Alleen Google blijft handwerk.

**Live op staging**, met een echt weggooi-adres. Minimaal: registreren, inloggen, wachtwoord
vergeten, Google op een nieuw adres, Google op een adres dat al een wachtwoord had (de
koppeling), een magic-link-account uit de oude flow (zie §11), event-profiel erbij maken, en
`/bedrijf` op een telefoon.

---

## 13. Wat jij moet doen (kan ik niet voor je)

1. **Google-provider aanzetten** in Firebase Auth, en het OAuth-consent-screen invullen
   (app-naam, logo, privacy-URL).
2. **Authorized domains** nakijken voor staging én 2happies.nl — dit is eerder al een keer
   stukgelopen.
3. Eventueel `authDomain` naar een subdomein van 2happies.nl verleggen, voor Safari.
4. Optioneel: de Firebase-mailtemplates voor wachtwoord-reset en e-mailverificatie in het
   Nederlands zetten. Standaard zijn ze Engels en komen ze van
   `noreply@<project>.firebaseapp.com`; een eigen afzenderdomein vereist DNS-records, maar dat
   is nu een verfraaiing en geen blokkade.

Geen Resend, geen secrets, geen TTL-policy. Dat is de winst van deze keuze.

---

## 14. Bouwvolgorde

| Fase | Wat | Los te verifiëren? |
|---|---|---|
| 1 | `auth.ts` opschonen + `useAuth.tsx` naar dubbele rol | Ja — units |
| 2 | Inlogscherm in login7-layout, drie standen, + Google | Ja — live op staging |
| 3 | Onboarding + toestemming + keuzescherm | Ja |
| 4 | `/bedrijf`, tabs, formulier uit z'n venster | Ja |
| 5 | Oude componenten weg, CSP, `PrivacyModal`, docs, live-verificatie | — |

Elke fase is los te deployen zonder de app kapot te laten staan, mits het oude inlogscherm pas
in fase 5 weggaat. Er zit **niets** meer in dit plan dat op een externe dienst of op
DNS-propagatie wacht — dat was de hele reden voor de koerswijziging.

---

## 15. Risico's

| Risico | Hoe erg | Wat we eraan doen |
|---|---|---|
| Magic-link-accounts kunnen geen wachtwoord zetten | die accounts onbereikbaar | live verifiëren vóór de magic link eruit gaat (§11); terugval via Google of Admin SDK |
| Google-koppeling op een bestaand wachtwoord-account faalt | inlog stuk voor die groep | live testen in fase 2, vóór het oude scherm weggaat |
| Safari-redirect faalt door storage partitioning | Google werkt niet op iOS | popup eerst; `authDomain` verleggen |
| Marketingtoestemming op een onbevestigd adres | juridisch wankel | verificatiemail bij registratie; alleen bevestigde adressen in een mailinglijst |
| Formuliersplitsing sloopt het adminpaneel | 30+ tests, admin-flow | de wrapper houdt dezelfde props; `AdminPanel` wordt niet aangeraakt |
| Zwakke wachtwoorden | account-overname | minimaal 8 tekens in de UI (Firebase eist er maar 6) |
| login7 is betaalde code | licentie | layout nabouwen in CSS Modules, hun code niet importeren |
| Iedereen krijgt een bezoekersprofiel, ook admins | ruis in `visitors` | bewust; het bezoekersprofiel *is* het account |
```

Twee dingen uit dit plan zijn niet zomaar een detail: **CLAUDE.md in de reporoot beschrijft nog
de oude monoliet** (`public/index.html`, "geen build step") en klopt niet meer met wat hier
gebouwd wordt — die is los bij te werken. En de compliance-documenten moeten mee zodra dit
landt, want een inlogflow en een marketingtoestemming raken beide ISO 27001-onderwerpen.
