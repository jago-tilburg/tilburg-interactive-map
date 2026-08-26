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
| E-mailverificatie | Verificatiemail bij registratie + een blijvende herinnering in de app. **Niet blokkerend.** |
| Magic link | Gaat eruit — één inlogflow voor iedereen |
| Bestaande testaccounts | **Worden gewist** — geen migratiepad nodig |

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

### E-mailverificatie
Bij een code-inlog wás het adres bewezen — je had de code immers. Bij wachtwoordregistratie is
`emailVerified` **onwaar**, en dan zou je een marketingtoestemming hebben op een adres dat
niemand heeft bevestigd.

Daarom: **bij registratie `sendEmailVerification`** (Firebase verstuurt die mail zelf, geen
provider nodig), en daarna een blijvende herinnering in de app tot het gebeurd is. **Niet
blokkerend** — je kunt de app volledig gebruiken met een onbevestigd adres. Wel blijft staan dat
een toekomstige mailinglijst alleen bevestigde adressen meeneemt; dát is waar de verificatie
z'n werk doet.

Google-gebruikers zijn per definitie al bevestigd en zien de herinnering nooit.

Wil je later tóch een harde grens, dan is de natuurlijke plek het **aanmaken van een event** —
daar zit geld en een openbare vermelding aan vast. Niet nu inbouwen, maar wel de plek om het te
zetten als je erop terugkomt.

#### De valkuil: `emailVerified` verandert niet vanzelf
De gebruiker klikt de link in z'n mailprogramma, en dat gebeurt buiten je app om. Het
`User`-object in de lopende sessie merkt daar **niets** van: `user.emailVerified` blijft `false`
tot je expliciet `user.reload()` aanroept. Zonder dat blijft de herinnering staan terwijl het
adres al bevestigd is — en dat is precies het soort ding dat een gebruiker drie keer laat
klikken en dan opgeeft.

Dus: `reload()` bij het terugkeren naar het tabblad (`visibilitychange`), plus een knop
"Ik heb het bevestigd" die hetzelfde doet. Firebase knijpt `sendEmailVerification` ook af bij
te vaak versturen, dus de "opnieuw versturen"-knop krijgt een aftelblokkade van 60 seconden.

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
- `reloadCurrentUser()` — `user.reload()`, nodig om een inmiddels bevestigd adres op te pikken
  (zie §3)

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

Erbij in de context: `refreshCurrentVisitor` naast de bestaande `refreshCurrentBusiness`,
`needsOnboarding` (waar of onwaar op basis van "heeft dit bezoekersprofiel al een
`marketingConsent`-veld"), en `emailVerified` — die laatste als eigen state, niet als
`currentUser.emailVerified`, want dat veld verandert pas na een `reload()` en een React-state
buiten het `User`-object om is de enige manier waarop een hertekening ook echt volgt.

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

### De verificatieherinnering
Nieuw component `components/auth/EmailVerifyNotice.tsx`. Zichtbaar zolang je ingelogd bent met
een onbevestigd adres — dus niet voor Google-gebruikers, en niet voor uitgelogde bezoekers.

```
  ┌────────────────────────────────────────┐
  │ ✉  Bevestig je e-mailadres             │
  │    We hebben een link gestuurd naar    │
  │    jago@example.nl                     │
  │    [ Ik heb het bevestigd ]            │
  │    [ Opnieuw versturen (58s) ]      ✕  │
  └────────────────────────────────────────┘
```

Twee plekken, want dat is waar je bent:
- als strook onder de header op de kaart
- als strook boven de tabs op `/bedrijf`

Wegklikken met ✕ verbergt hem voor de rest van de sessie (`sessionStorage`, niet
`localStorage` — bij de volgende keer dat je de app opent hoort hij er weer te zijn, anders is
het geen herinnering meer). "Ik heb het bevestigd" doet `reload()` en laat een toast zien als het
adres nog steeds onbevestigd is; anders verdwijnt de strook.

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

## 11. Bestaande accounts: wissen

Prod draait nog de oude monoliet op RTDB, dus er zijn **geen echte accounts** die dit raakt.
Alles wat er op staging staat is testmateriaal en mag weg. Daarmee verdwijnt het enige
migratiepunt dat dit plan had — magic-link-accounts zonder wachtwoord hoeven nergens naartoe
gered te worden.

Eenmalig Admin-SDK-scriptje in `scripts/`, in deze volgorde:

1. **`businessEvents`** waarvan de `ownerId` bij een te wissen account hoort, doc per doc.
   Niet in bulk via `firebase firestore:delete`, en niet ná de accounts — want deze deletes
   moeten `cleanupBusinessEventPhotos` afvuren, en dat is de enige manier waarop de bijbehorende
   foto's uit Storage verdwijnen. Wis je de accounts eerst, dan weet je niet meer welke events
   erbij hoorden en houd je zwevende foto's over die niets meer opruimt.
2. **`visitors/*` en `businesses/*`** — die zijn niet aan triggers gekoppeld, dus bulk mag.
3. **De Auth-users**, met `listUsers()` + `deleteUsers()` in batches.

**Het adminaccount blijft staan** en wordt expliciet uitgezonderd van de wipe. Dat is geen
gemak maar noodzaak: admin-zijn hangt aan `admins/{uid}` en die uid is de Auth-uid. Wis je hem
mee, dan krijg je bij het opnieuw aanmaken een **nieuwe uid**, wijst dat `admins`-document naar
een dode uid, en is `admins` client-side niet schrijfbaar (`allow read, write: if false`) — dus
je kunt het ook niet even vanuit de app rechtzetten. De uitzonderingslijst in het script gaat
op **uid**, niet op e-mailadres, zodat een typefout in een adres niet stilletjes je admin
opruimt.

Wat er **niet** gewist wordt: het adminaccount, de 62 echte winkels in RTDB, en de
`umbrellaEvents`. Die laatste twee hangen niet aan een account.

### Testaccounts die het script daarna aanmaakt

De oude accounts komen uit de magic-link-flow en hebben geen wachtwoord, dus die zijn onbruikbaar
om mee te testen — ze worden niet gered maar **vers opgebouwd**, met wachtwoorden die je kent:

| Account | Rollen | `emailVerified` | Waarvoor |
|---|---|---|---|
| admin *(behouden)* | admin + bezoeker | zoals het is | adminpaneel, en het feit dat admin nu óók een bezoekersprofiel krijgt |
| test-bezoeker | alleen bezoeker | **false** | de "Event-profiel aanmaken"-tak van het keuzescherm, en de verificatiestrook in levende lijve |
| test-owner | bezoeker + event owner | true | de dubbele rol, het volledige keuzescherm met drie knoppen, en `/bedrijf` |

Twee dingen over die tabel die de moeite zijn:

**Een event-owner-zonder-bezoekersprofiel bestaat niet meer.** Dat is geen omissie in de
testdata maar het model zelf: iedereen die inlogt krijgt een bezoekersprofiel, en het
event-profiel komt erbovenop. Er is dus geen vierde rij, en als er ooit een account opduikt met
alleen `businesses/{uid}`, is dat een bug.

**`emailVerified: false` op de bezoeker is opzet.** Anders zie je de verificatiestrook nooit
tijdens het bouwen, en dan merk je de valkuil uit §3 — dat het veld niet vanzelf bijwerkt — pas
als een echte gebruiker erover struikelt. Gebruik voor beide adressen een inbox die je echt kunt
openen (plus-adressering op een adres dat je al hebt werkt; Firebase ziet `naam+a@` en `naam+b@`
als twee losse accounts).

**En test-owner krijgt events**, anders is de Inzicht-tab een leeg vlak en kun je niets zien
werken: minimaal één `approved` + `paid` event (zodat de LIVE-status en de statistiekkaarten
iets tonen), één `pending` event (de onbetaalde tak), en op één ervan wat views/clicks/shares
zodat de cijfers niet allemaal 0 zijn. Die velden zijn server-autoritair en client-side niet
te zetten, maar de Admin SDK gaat langs de rules heen, dus het seed-script kan ze direct
schrijven.

Het script draait één keer, tegen staging, en gaat daarna weg — geen permanent stukje
gereedschap dat per ongeluk tegen prod kan wijzen. Vóór het wist, print het wat het gaat wissen
en wat het overslaat, en wacht op een bevestiging.

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
- `EmailVerifyNotice`: onzichtbaar bij een bevestigd adres en bij Google; "Ik heb het bevestigd"
  roept `reload()` aan; blijft staan mét toast als het adres nóg niet bevestigd is; wegklikken
  houdt binnen de sessie stand maar niet erbuiten; de hersturen-blokkade telt af en laat weer los

**Rules (`rules-tests/`)** — let op: `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"` nodig
- `visitors` create met, zonder, en met een niet-boolean `marketingConsent`
- `businesses` create op een uid die al een bezoekersprofiel heeft

**E2E (playwright)** — nu een stuk simpeler dan met codes: registreren en inloggen met
wachtwoord kan volledig geautomatiseerd, zonder testmodus of achterdeur in een Cloud Function.
Alleen Google blijft handwerk.

**Live op staging**, met de drie accounts uit §11 plus een vers weggooi-adres voor de
registratieflow zelf. Minimaal: registreren, inloggen, wachtwoord
vergeten, **de verificatiemail daadwerkelijk ontvangen en de link aanklikken** (en dan kijken of
de strook ook echt verdwijnt — zie de valkuil in §3), Google op een nieuw adres, Google op een
adres dat al een wachtwoord had (de koppeling), event-profiel erbij maken, en `/bedrijf` op een
telefoon.

---

## 13. Wat jij moet doen (kan ik niet voor je)

1. **Google-provider aanzetten** in Firebase Auth, en het OAuth-consent-screen invullen
   (app-naam, logo, privacy-URL).
2. **Authorized domains** nakijken voor staging én 2happies.nl — dit is eerder al een keer
   stukgelopen.
3. Eventueel `authDomain` naar een subdomein van 2happies.nl verleggen, voor Safari.
4. **De Firebase-mailtemplates in het Nederlands zetten** — verificatie én wachtwoord-reset.
   Standaard zijn ze Engels en komen ze van `noreply@<project>.firebaseapp.com`. Dit stond
   eerst als "optioneel", maar nu de app iedereen actief om verificatie vraagt, is die mail
   onderdeel van de flow geworden en niet langer een uithoek: een Engelse mail van een
   `firebaseapp.com`-afzender ziet uit als phishing en wordt niet aangeklikt. Een eigen
   afzenderdomein vereist DNS-records en is nog steeds optioneel; de Nederlandse tekst niet.

Geen Resend, geen secrets, geen TTL-policy. Dat is de winst van deze keuze.

---

## 14. Bouwvolgorde

| Fase | Wat | Los te verifiëren? |
|---|---|---|
| 0 | Testaccounts wissen + drie verse aanmaken met events (§11) | Ja — tellen in de console |
| 1 | `auth.ts` opschonen + `useAuth.tsx` naar dubbele rol | Ja — units |
| 2 | Inlogscherm in login7-layout, drie standen, + Google | Ja — live op staging |
| 3 | Verificatiemail + herinneringsstrook | Ja — live, met een echte mail |
| 4 | Onboarding + toestemming + keuzescherm | Ja |
| 5 | `/bedrijf`, tabs, formulier uit z'n venster | Ja |
| 6 | Oude componenten weg, CSP, `PrivacyModal`, docs, live-verificatie | — |

Fase 0 eerst, en niet later: zolang er nog magic-link-accounts zonder wachtwoord in Auth staan,
test je in fase 2 tegen accounts die in de nieuwe flow niet kunnen bestaan, en jaag je op fouten
die na de wipe verdwenen zouden zijn.

Elke fase is los te deployen zonder de app kapot te laten staan, mits het oude inlogscherm pas
in fase 6 weggaat. Er zit **niets** in dit plan dat op een externe dienst of op DNS-propagatie
wacht — dat was de hele reden voor de koerswijziging.

---

## 15. Risico's

| Risico | Hoe erg | Wat we eraan doen |
|---|---|---|
| De wipe neemt het adminaccount mee | `admins/{uid}` wijst naar een dode uid en is client-side niet te repareren | uitgezonderd op **uid**, niet op e-mailadres (§11); droogloop-uitdraai vóór het wissen |
| Events eerst wissen wordt vergeten | zwevende foto's in Storage die niets meer opruimt | doc-per-doc en vóór de accounts, zodat `cleanupBusinessEventPhotos` afvuurt (§11) |
| `emailVerified` blijft `false` in de sessie | strook blijft staan na een geslaagde verificatie | `reload()` op `visibilitychange` + "Ik heb het bevestigd"-knop (§3) |
| Verificatiemail leest als phishing | niemand klikt, dus niemand verifieert | Nederlandse templates (§13); eventueel eigen afzenderdomein |
| Google-koppeling op een bestaand wachtwoord-account faalt | inlog stuk voor die groep | live testen in fase 2, vóór het oude scherm weggaat |
| Safari-redirect faalt door storage partitioning | Google werkt niet op iOS | popup eerst; `authDomain` verleggen |
| Formuliersplitsing sloopt het adminpaneel | 30+ tests, admin-flow | de wrapper houdt dezelfde props; `AdminPanel` wordt niet aangeraakt |
| Zwakke wachtwoorden | account-overname | minimaal 8 tekens in de UI (Firebase eist er maar 6) |
| login7 is betaalde code | licentie | layout nabouwen in CSS Modules, hun code niet importeren |
| Iedereen krijgt een bezoekersprofiel, ook admins | ruis in `visitors` | bewust; het bezoekersprofiel *is* het account |

Twee dingen uit dit plan zijn niet zomaar een detail: **CLAUDE.md in de reporoot beschrijft nog
de oude monoliet** (`public/index.html`, "geen build step") en klopt niet meer met wat hier
gebouwd wordt — die is los bij te werken. En de compliance-documenten moeten mee zodra dit
landt, want een inlogflow en een marketingtoestemming raken beide ISO 27001-onderwerpen.
