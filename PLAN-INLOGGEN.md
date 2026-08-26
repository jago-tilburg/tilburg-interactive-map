# Plan — Inloggen herbouwen (passwordless code + dubbele rol + bedrijfsomgeving)

Branch: **`staging-next`**. Niets van dit plan raakt `main`/prod.
Opgesteld 2026-08-26.

---

## 0. Vastgelegde keuzes

| Onderwerp | Keuze |
|---|---|
| Inlogmethode | E-mail + 6-cijferige code die je zelf invult. Geen wachtwoorden meer. |
| Mailprovider | **Resend** (HTTP-API, DNS-verificatie op 2happies.nl) |
| Google-inloggen | **Ja**, erbij (zoals login7) |
| Admin | Logt óók in met code. Admin-zijn blijft `admins/{uid}` in Firestore. |
| Dubbele rol | **Één account.** Bezoekersprofiel is de basis; event-profiel is een aanvulling op hetzelfde account. |
| Na inloggen | **Keuzescherm**: 1) de kaart, 2) bezoekersprofiel, 3) event-profiel |
| Bezoekersprofiel | Blijft een **venster over de kaart** — geen aparte pagina |
| Bedrijfsomgeving | **Schermvullende pagina** `/bedrijf` met tabs: Inzicht / Nieuw event / Profiel |
| Inzicht-tab | Statistiekkaarten bovenaan, eigen eventlijst eronder |
| Nieuw-event-tab | Formulier **direct op de pagina**, geen venster |
| Marketingtoestemming | Aan **iedereen** gevraagd bij de eerste keer inloggen |

### Aanname die ik zelf heb ingevuld
Op het keuzescherm staat de derde knop er **altijd**. Heb je nog geen event-profiel,
dan leest die "Event-profiel aanmaken" en vraagt hij om je bedrijfsnaam. Zo is de
upgrade van bezoeker naar event owner altijd één klik weg, precies het punt van
"zowel bezoeker als event owner kunnen zijn". Zeg het als je liever alleen de knoppen
ziet die je al hebt.

---

## 1. Waarom dit niet "even een veld omzetten" is

Firebase Auth kan **geen e-mailcodes**. Het heeft magic links (nu voor bezoekers,
`sendVisitorMagicLink` in `web/src/lib/firebase/auth.ts:34`) en e-mail+wachtwoord (nu voor
bedrijven en admin). Een code die de gebruiker zélf intypt bestaat niet als ingebouwde
provider en kan ook niet uit de magic link gepeuterd worden — de `oobCode` daarin is een
lange willekeurige string, niet iets wat een mens overtypt.

De code-flow moet dus zelfgebouwd worden bovenop **custom tokens**:

```
  Gebruiker                Cloud Function              Firebase Auth
     │                          │                            │
     │  e-mail ───────────────► requestLoginCode              │
     │                          │  genereert 6 cijfers        │
     │                          │  slaat hash op              │
     │                          │  mailt via Resend           │
     │  ◄──────── {ok:true} ────┤                            │
     │                          │                            │
     │  e-mail + code ────────► verifyLoginCode               │
     │                          │  vergelijkt hash            │
     │                          │  zoekt/maakt user ────────► │
     │                          │  ◄──── uid ──────────────── │
     │                          │  createCustomToken ───────► │
     │  ◄──── customToken ──────┤                            │
     │                                                        │
     │  signInWithCustomToken ───────────────────────────────► │
     │  ◄──────────────── ingelogd ────────────────────────── │
```

De tweede reden dat dit geen kleine ingreep is: **bezoeker en bedrijf sluiten elkaar nu
structureel uit**. `web/src/hooks/useAuth.tsx:110` doet letterlijk:

```ts
const biz = await getBusinessProfile(user.uid);
if (biz) { setCurrentBusiness(biz); setCurrentVisitor(null); }
else { ...; setCurrentVisitor(visitor); setCurrentBusiness(null); }
```

Eén van de twee is altijd `null`. Dat moet eruit voordat één account beide kan zijn. Datzelfde
blok zet trouwens ook `isAdmin` als een uitsluitende toestand (regel 100-105) — die gaat om
dezelfde reden om.

---

## 2. Datamodel

### Nieuw: `loginCodes/{sha256(email)}`
Alleen door de Admin SDK aan te raken, nooit door een client.

| Veld | Type | Waarom |
|---|---|---|
| `email` | string | genormaliseerd (trim + lowercase) |
| `codeHash` | string | `sha256(code + pepper)` — de code zelf staat nergens opgeslagen |
| `expiresAt` | Timestamp | nu + 10 minuten |
| `attempts` | number | max 5, dan is de code dood |
| `lastSentAt` | Timestamp | voor de 60-seconden-hersturen-limiet |
| `sendCount` | number | max 5 per uur per e-mailadres |

De doc-id is een hash van het e-mailadres, niet het adres zelf — dan staat er geen lijst van
e-mailadressen in je Firestore-index. Opruimen gebeurt met een **Firestore TTL-policy op
`expiresAt`**, niet met een cron-functie: minder code, en Google ruimt het gratis op.

### Nieuw: `loginRateLimits/{sha256(ip)}`
`count` + `windowStart`. Vangt de "iemand vuurt duizend e-mailadressen af"-kant af, die de
per-e-mail-limiet niet ziet.

### Uitbreiding: `visitors/{uid}`
```ts
export interface Visitor {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
  savedEventIds?: string[];
  marketingConsent?: boolean;         // NIEUW
  marketingConsentAt?: Timestamp;     // NIEUW — wanneer gegeven of ingetrokken
  marketingConsentSource?: "signup" | "profile";  // NIEUW
}
```

`businesses/{uid}` verandert niet van vorm. Wat verandert is *wanneer* het bestaat: niet meer
bij registratie, maar op het moment dat iemand een event-profiel aanmaakt. Het `Business`-type
in `web/src/types/account.ts` blijft zoals het is.

### GDPR-punten bij die toestemming
- Standaard **uitgevinkt**. Een voorgevinkt vakje is geen geldige toestemming.
- **Los** van "ik accepteer de voorwaarden" — nooit één vinkje voor beide.
- **Intrekbaar** met dezelfde moeite als geven: een schakelaar in het bezoekersprofiel.
- `PrivacyModal.tsx` moet bijgewerkt: waarvoor het adres gebruikt wordt, en dat inlogcodes
  10 minuten bewaard worden.
- Optioneel, voor echte auditeerbaarheid: een `consentLog`-subcollectie die elke wijziging
  bijhoudt in plaats van alleen de laatste stand. Nu overkill, maar noem het als je ooit een
  klacht moet kunnen navertellen.

---

## 3. Backend — `functions/index.js`

Twee nieuwe callables, plus `resend` als dependency.

### `requestLoginCode({ email })`
Secrets: `RESEND_API_KEY`, `LOGIN_CODE_PEPPER`.

1. E-mail normaliseren en op vorm valideren.
2. Rate limits, in deze volgorde: per e-mail max 1 code per 60s en 5 per uur; per IP
   (`request.rawRequest.ip`) max 20 per uur.
3. Code met `crypto.randomInt(0, 1_000_000)` en links opvullen met nullen. **Niet
   `Math.random()`** — dat is geen CSPRNG en een voorspelbare inlogcode is een open deur.
4. `codeHash` opslaan, `expiresAt` op nu+10min, `attempts` op 0.
5. Mailen via Resend. Zet de code **ook in de subject-regel** ("Je inlogcode: 123456") —
   op een telefoon lees je hem dan uit de notificatie zonder de mail te openen.
6. **Altijd `{ ok: true }` teruggeven**, ook als het adres onbekend is. Anders wordt deze
   functie een gratis "bestaat dit account?"-checker. Of je nieuw bent merkt de app pas ná
   het inloggen, aan de client-kant, en dat lekt niets.

### `verifyLoginCode({ email, code })`
Secret: `LOGIN_CODE_PEPPER`.

1. Doc ophalen. Bestaat niet / verlopen / `attempts >= 5` → `HttpsError` en klaar.
2. Hashes vergelijken met `crypto.timingSafeEqual`, niet met `===`.
3. Mis? `attempts` +1 en een generieke fout ("Code onjuist of verlopen") — nooit het
   verschil tussen "verkeerd" en "verlopen" prijsgeven.
4. Goed? Doc **verwijderen** (eenmalig gebruik), dan `getUserByEmail` en anders
   `createUser({ email, emailVerified: true })`. Die `emailVerified` is hier terecht: dat
   iemand de code heeft, ís het bewijs dat de inbox van hem is.
5. `createCustomToken(uid)` teruggeven.

### Audit logging
Meeliften op wat er al staat (zie `project_2happies_audit_logging_2026_08_26`): gestructureerde
log-regels voor verstuurde code, mislukte poging, rate limit geraakt, nieuw account aangemaakt.
Nooit de code of de hash in de log.

### Bestaande functies
Ongemoeid. `createCheckoutSession` en `stripeWebhook` hangen aan `request.auth.uid`, en dat werkt
identiek na een custom-token-login.

---

## 4. Firestore rules

`firestore.rules` — expliciet dichtzetten, ook al vangt de catch-all onderaan het al:

```
match /loginCodes/{doc}      { allow read, write: if false; }
match /loginRateLimits/{doc} { allow read, write: if false; }
```

Expliciet, met commentaar, omdat "dit is per ongeluk niet open" en "dit is opzettelijk dicht"
er in een pen-test hetzelfde uitzien.

Bij `visitors/{uid}` de create-regel uitbreiden met een typecheck op het nieuwe veld:

```
&& (!('marketingConsent' in request.resource.data)
    || request.resource.data.marketingConsent is bool)
```

`businesses/{uid}` hoeft niet aangepast: de regel eist alleen dat `uid` klopt en is dus al
geschikt voor "later aangemaakt op een bestaand account".

---

## 5. Client — de authenticatielaag

### `web/src/lib/firebase/auth.ts`
**Erbij:** `requestLoginCode`, `verifyLoginCode` (callables), `signInWithLoginCode`
(verify → `signInWithCustomToken`), `signInWithGoogle`.

**Eruit:** `visitorActionCodeSettings`, `sendVisitorMagicLink`, `isVisitorMagicLink`,
`completeVisitorMagicLink`, `VISITOR_AUTH_EMAIL_KEY`, `loginBusiness`, `registerBusiness`,
`loginAdmin`, `changeBusinessPassword`. `signOutCurrentUser` en `deleteCurrentUser` blijven.

### `web/src/hooks/useAuth.tsx`
De kern van de dubbele rol. Het huidige `if (biz) … else …` wordt:

```ts
const [biz, visitor] = await Promise.all([
  getBusinessProfile(user.uid),
  getVisitorProfile(user.uid),
]);
setCurrentBusiness(biz);                                  // mag samen met
setCurrentVisitor(visitor ?? await createVisitorProfile(user.uid, user.email ?? ""));
```

Drie gevolgen om bewust te accepteren:
- **Iedereen krijgt een bezoekersprofiel**, ook event owners en admins. Dat is het punt van
  het model: het bezoekersprofiel *is* je account.
- `isAdmin` wordt **aanvullend** in plaats van uitsluitend — een admin heeft nu ook een
  bezoekersprofiel. De huidige short-circuit op regel 100-105 gaat eruit.
- De magic-link-afhandeling in het eerste `useEffect` (regel 60-77) gaat helemaal weg,
  inclusief die `window.prompt`. Daarmee verdwijnt ook de `suppressAutoProfileLoadRef`-dans:
  het account wordt nu server-side aangemaakt vóórdat de client is ingelogd, dus er is geen
  race tussen registratie en de auth-listener meer om te onderdrukken. Dat ref-veld kan uit
  de context.

Erbij in de context: `refreshCurrentVisitor` (naast de bestaande `refreshCurrentBusiness`),
en `needsOnboarding` — waar of onwaar op basis van "heeft dit bezoekersprofiel al een
`marketingConsent`-veld".

---

## 6. Het inlogscherm (login7-layout)

login7 is een **betaald block** van shadcnblocks, gebouwd op shadcn/ui + Tailwind. Dit project
heeft shadcn bewust afgewezen (te Tailwind-gebonden) en gebruikt Radix-primitives met CSS
Modules. We bouwen dus de **layout** na in CSS Modules; we importeren hun code niet. Dat is
zowel technisch nodig als licentietechnisch de schone route.

Wat login7 is, en wat wij ervan overnemen:

| login7 | Bij ons |
|---|---|
| Gecentreerde card, max 380px, rand zonder schaduw | idem |
| Logo + merknaam in de header | 2happies-logo + "2happies" |
| Google-knop (outline) | "Doorgaan met Google" |
| "OR"-divider | "of" |
| E-mailveld | stap 1: e-mailveld |
| Wachtwoordveld | **vervangen** door het codeveld in stap 2 |
| Full-width primary submit | "Stuur me een code" / "Inloggen" |
| "Nog geen account?"-link eronder | "Je hoeft niets aan te maken — vul je e-mailadres in." |

Dat laatste is de fijnste bijwerking van passwordless: registreren en inloggen zijn dezelfde
handeling geworden, dus die hele tweede formulierstand uit `BusinessAuthModal` verdwijnt.

Het codeveld wordt **één invoerveld**, geen zes losse vakjes:

```tsx
<input
  inputMode="numeric"
  autoComplete="one-time-code"   // iOS/Android bieden de code uit de mail aan
  maxLength={6}
  pattern="\d{6}"
/>
```

Zes losse vakjes zien er leuk uit maar breken plakken uit de mail — precies de handeling die
je beschreef ("gebruiker kopieert code") — en zijn een ramp voor schermlezers.

Stap 2 heeft daarnaast: "Code opnieuw sturen" met een aftellende 60-seconden-blokkade, en
"Ander e-mailadres" om terug te gaan.

**Waar dit scherm leeft:** een venster over de kaart, zoals nu, geopend uit het accountmenu.
Consistent met "een profiel is een venster over de kaart", en je verliest je kaartpositie niet.
De gecentreerde 380px-card van login7 werkt daarbinnen prima.

### Google-inloggen — drie dingen die stuk gaan als je ze overslaat
1. **CSP.** `next.config.ts` moet `https://apis.google.com` en `https://accounts.google.com`
   in `script-src`, en `https://<project>.firebaseapp.com` + `https://accounts.google.com` in
   `frame-src`. `connect-src` staat al op `https:` en is dus dekkend.
2. **Safari en storage partitioning.** De standaard `authDomain` is
   `<project>.firebaseapp.com`, een ander domein dan 2happies.nl. Redirect-sign-in leunt daar
   op cross-site opslag, en dat knijpen browsers dicht. Oplossing: `authDomain` op een
   subdomein van 2happies.nl zetten en `/__/auth/handler` daar laten serveren. Popup eerst,
   redirect als terugval.
3. **Accountkoppeling.** Iemand logt eerst met een code in (user aangemaakt door de Admin SDK,
   zonder provider) en komt later terug via Google op hetzelfde adres. Met "één account per
   e-mailadres" aan — de standaard — hoort Firebase `google.com` aan diezelfde uid te hangen.
   Dít moet je live testen, niet aannemen: de foutvariant is
   `auth/account-exists-with-different-credential` en die wil je niet voor het eerst in
   productie zien.

---

## 7. Na het inloggen: onboarding en het keuzescherm

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

Vinkje staat uit. Doorgaan mag ook zonder het vinkje. Wat er wordt opgeslagen is de
uitkomst *en* het moment (`marketingConsentAt`), zodat je later kunt aantonen wanneer iemand
ja zei.

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

Heb je nog geen event-profiel, dan leest knop 3 "Event-profiel aanmaken" en vraagt hij eerst
om je bedrijfsnaam (`createBusinessProfile`, die functie bestaat al) voordat hij je naar
`/bedrijf` stuurt.

Dit is één component met drie standen (`onboarding` → `chooser` → `createBusiness`) in
hetzelfde venster als het inlogscherm. Geen route-gedoe, geen flits van de kaart ertussen.

---

## 8. `/bedrijf` — de schermvullende bedrijfsomgeving

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
  │   │ [Bewerk] [Dupliceer] [Verwijder]│ │
  │   └──────────────────────────────┘    │
  └────────────────────────────────────────┘
```

Radix `Tabs` — al in gebruik in `BusinessDashboard.tsx:4`, dus geen nieuwe afhankelijkheid.
Tabstand in de URL (`/bedrijf?tab=nieuw`) zodat vernieuwen en terug-knop werken.

De 409 regels van `BusinessDashboard.tsx` worden opgesplitst:

| Nieuw bestand | Komt uit |
|---|---|
| `components/business/InsightsTab.tsx` | de totalen op regel 190-192 als kaarten, plus de eventlijst en al z'n acties |
| `components/business/NewEventTab.tsx` | dun omhulsel om het formulier |
| `components/business/BusinessProfileTab.tsx` | de settings-tab, minus alles rond wachtwoorden |
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

Eén ding dat wél anders wordt: het formulier had "sluiten" als uitgang. Inline is er niets om
te sluiten, dus na opslaan springt de app naar de Inzicht-tab met een toast. `onClose` wordt
daarom `onDone`.

### Profiel-tab
Bedrijfsnaam, standaardadres/lat/lng (bestaat al), plus:
- **eruit:** wachtwoord wijzigen — er is geen wachtwoord meer
- **erbij:** het e-mailadres, alleen-lezen (dat ís je inlog)
- **erbij:** "Event-profiel verwijderen" die alleen `businesses/{uid}` en de eigen events
  opruimt en je bezoekersaccount laat staan. Dat is nieuw en volgt rechtstreeks uit het
  dubbele-rol-model: je rol opgeven is niet hetzelfde als je account opzeggen. Het bestaande
  `deleteBusinessAccountCascade` moet daarvoor gesplitst worden in "gooi de bedrijfskant weg"
  en "gooi het hele account weg".

---

## 9. Wat er verdwijnt

| Weg | Waarom |
|---|---|
| `auth/VisitorAuthModal.tsx` | opgeslokt door één inlogscherm |
| `auth/BusinessAuthModal.tsx` | idem — en registreren is nu hetzelfde als inloggen |
| `auth/AdminLoginModal.tsx` | admin logt in via hetzelfde scherm |
| `auth/AccountChooserModal.tsx` | de rolkeuze is nu ná het inloggen, niet ervoor |
| `auth/BusinessDashboard.tsx` | wordt `/bedrijf` |
| magic-link-code in `auth.ts` + `useAuth.tsx` | vervangen door codes |
| alles rond wachtwoorden | passwordless |

Het accountmenu (`AccountMenu.tsx`) verliest z'n prioriteitsladder (admin > bedrijf > bezoeker
> uitgelogd) en wordt een lijst van alles wat je hébt: profiel, bewaarde events, en als je die
rollen hebt ook bedrijfsomgeving en adminpaneel.

---

## 10. Wat er met bestaande accounts gebeurt

Prod draait nog de oude monoliet op RTDB, dus er zijn **geen echte accounts** die dit raakt —
alleen testaccounts op staging.

Die blijven werken: `verifyLoginCode` zoekt op e-mailadres en vindt dezelfde bestaande uid, dus
alle events, bewaarde events en profielen blijven eraan hangen. Hun wachtwoord wordt alleen
nooit meer gebruikt.

**Eén beslissing die ik aan jou laat:** dat wachtwoord blíjft wel op het account staan. De UI
is weg, maar de credential niet, en daarmee blijft er een tweede manier bestaan om binnen te
komen die niemand meer test of monitort. Wil je dat opruimen, dan is dat een eenmalig
Admin-SDK-scriptje dat de wachtwoordprovider van elke bestaande user afhaalt. Ik zou het doen,
maar niet stilletjes.

---

## 11. Testen

**Unit (vitest, `web/tests/unit/`)**
- Inlogscherm: stap 1 → 2, ongeldige code, hersturen-blokkade loopt af, "ander e-mailadres"
- Onboarding: vinkje staat standaard uit; doorgaan zonder vinkje slaat `false` + tijdstip op
- Keuzescherm: drie takken, en de "nog geen event-profiel"-variant
- `useAuth`: bezoeker én bedrijf tegelijk gevuld; admin krijgt óók een bezoekersprofiel
- `BusinessShell`: tabs wisselen, tabstand uit de URL
- `BusinessEventForm`: bestaande modal-tests moeten ongewijzigd groen blijven

**Functions (vitest, `functions/test/`)**
- `requestLoginCode`: rate limits per e-mail en per IP, code is 6 cijfers, hash != code,
  Resend gemockt, en dat een onbekend adres *dezelfde* respons geeft als een bekend
- `verifyLoginCode`: verlopen, opgebruikt, 6e poging, timing-safe vergelijking, nieuwe user
  aangemaakt met `emailVerified: true`

**Rules (`rules-tests/`)** — let op: `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"` nodig
- `loginCodes` en `loginRateLimits` volledig dicht voor clients
- `visitors` create met en zonder `marketingConsent`, en met een niet-boolean waarde
- `businesses` create op een uid die al een bezoekersprofiel heeft

**E2E (playwright)** — de code moet ergens uit de test komen. Voorstel: een
`LOGIN_CODE_TEST_MODE`-secret waarmee `requestLoginCode` de code teruggeeft, maar **alleen**
voor adressen op een vastgezette testdomein. Dat is een echte achterdeur, dus: apart secret,
alleen op staging gezet, en de domeincheck hardcoded in de functie. Zeg het als je dit liever
niet hebt — dan blijft de inlogflow handmatig getest.

**Live op staging**, met een echt weggooi-e-mailadres, zoals eerder deze week bij de
input-validatie. Minimaal: nieuw account met code, bestaand account met code, Google op een
nieuw adres, Google op een adres dat al met een code bestond (de koppeling), event-profiel
erbij maken, en `/bedrijf` op een telefoon.

---

## 12. Wat jij moet doen (kan ik niet voor je)

1. **Resend-account** aanmaken, `2happies.nl` verifiëren — SPF-, DKIM- en DMARC-records in DNS.
   Reken op propagatietijd; hier valt het hele plan stil zonder.
2. `firebase functions:secrets:set RESEND_API_KEY` en `LOGIN_CODE_PEPPER` (die tweede: gewoon
   32 random bytes hex).
3. **Google-provider aanzetten** in Firebase Auth, en het OAuth-consent-screen invullen
   (app-naam, logo, privacy-URL).
4. **Authorized domains** nakijken voor staging én 2happies.nl — dit is eerder al een keer
   stukgelopen.
5. Eventueel `authDomain` naar een subdomein van 2happies.nl verleggen, voor Safari.
6. **Firestore TTL-policy** op `loginCodes.expiresAt` (via `gcloud`).

---

## 13. Bouwvolgorde

| Fase | Wat | Los te verifiëren? |
|---|---|---|
| 1 | Functions + Resend + rules + TTL | Ja — emulator en een echte testmail, zonder één regel UI |
| 2 | `auth.ts` en `useAuth.tsx` omzetten naar codes + dubbele rol | Ja — units |
| 3 | Inlogscherm in login7-layout + Google | Ja — live op staging |
| 4 | Onboarding + toestemming + keuzescherm | Ja |
| 5 | `/bedrijf`, tabs, formulier uit z'n venster | Ja |
| 6 | Oude componenten weg, CSP, PrivacyModal, docs, live-verificatie | — |

Fase 1 eerst en apart, omdat het aan een externe dienst en aan DNS hangt: dat is het enige
stuk dat op iets kan wachten waar wij geen invloed op hebben. Fase 2-5 zijn ieder los te
deployen zonder de app kapot te laten staan, mits het oude inlogscherm pas in fase 6 weggaat.

---

## 14. Risico's

| Risico | Hoe erg | Wat we eraan doen |
|---|---|---|
| Resend-DNS niet op tijd door | blokkeert fase 1 | eerst opzetten, rest gaat door |
| Google-koppeling op een bestaand code-account faalt | inlog stuk voor die groep | live testen in fase 3, vóór het oude scherm weggaat |
| Safari-redirect faalt door storage partitioning | Google werkt niet op iOS | popup eerst; `authDomain` verleggen |
| 6 cijfers zijn te bruteforcen | account-overname | 5 pogingen, 10 min, limiet per e-mail én per IP. Zwakker dan een magic link — dat is de prijs van deze flow, en met deze limieten een aanvaardbare. |
| Formuliersplitsing sloopt het adminpaneel | 30+ tests, admin-flow | de wrapper houdt dezelfde props; `AdminPanel` wordt niet aangeraakt |
| Achtergebleven wachtwoorden | ongemonitorde tweede ingang | zie §10, jouw beslissing |
| login7 is betaalde code | licentie | layout nabouwen in CSS Modules, hun code niet importeren |
| Iedereen krijgt een bezoekersprofiel, ook admins | ruis in `visitors` | bewust; het bezoekersprofiel *is* het account |
```

Twee dingen uit dit plan zijn niet zomaar een detail: **CLAUDE.md in de reporoot beschrijft nog
de oude monoliet** (`public/index.html`, "geen build step") en klopt niet meer met wat hier
gebouwd wordt — die is los bij te werken. En de compliance-documenten moeten mee zodra dit
landt, want een inlogflow en een marketingtoestemming raken beide ISO 27001-onderwerpen.
