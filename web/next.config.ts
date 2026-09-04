import type { NextConfig } from "next";

// Every real third-party origin this app actually loads, confirmed by
// grepping src/ for script src="..." and known Firebase SDK endpoints —
// not guessed. Wildcarded subdomains (e.g. *.googleapis.com) rather than
// exact hosts, since Maps/GA4 use several subtly different subdomains this
// app doesn't control and shouldn't have to enumerate exactly.
// 'unsafe-inline' on script-src covers Next.js's own hydration scripts and
// the GA4 inline init snippet in layout.tsx (no nonce wiring exists yet);
// on style-src it covers this codebase's pervasive `style={{...}}` usage
// (marker/badge colors, umbrella pill backgrounds, etc.) — CSP still blocks
// loading a script/stylesheet from an untrusted origin either way, which is
// the more realistic threat here given there's no dangerouslySetInnerHTML
// anywhere in this app for inline-script injection to piggyback on.
// img-src/connect-src are deliberately broadened to any https: origin, not
// just the known API hosts above — shop/event `photoUrl` is an arbitrary,
// business/admin-supplied external image URL (no domain restriction is
// possible without breaking that real, by-design feature), rendered via
// both <img src> (img-src) AND fetchEventPhotoDataUrl()'s fetch() call
// that converts it to a base64 data URL for map markers (connect-src) —
// confirmed live: a narrower connect-src silently broke that exact fetch
// for the seed data's picsum.photos test images, which would have
// reintroduced the "event marker photos not rendering" bug fixed earlier
// this session. This is a real, known tradeoff (connect-src's exfiltration
// protection is weaker as a result) accepted specifically for this
// feature — script-src/frame-src/frame-ancestors/base-uri/form-action stay
// meaningfully restrictive since they don't have the same requirement.
const csp = [
  "default-src 'self'",
  // *.firebasedatabase.app in script-src is NOT a stray copy of the
  // connect-src entry below: when a WebSocket can't be established (some
  // mobile carriers/proxies block them), the RTDB SDK silently falls back
  // to its long-polling transport, which is JSONP — BrowserPollConnection
  // literally does createElement('script') against
  // https://<ns>.<region>.firebasedatabase.app/.lp?... Without this, that
  // fallback is CSP-blocked, the shops subscription never connects, and
  // the map renders with zero shop markers while Firestore-backed events
  // still show (Firestore uses fetch/XHR, so connect-src alone covers it).
  // Reproduced on a real iPhone on 5G, 2026-08-26.
  // apis.google.com + accounts.google.com: the Google Identity/GSI SDK that
  // signInWithPopup()/signInWithRedirect() load for "Doorgaan met Google"
  // (PLAN-INLOGGEN.md §7) — without these the popup script itself is
  // CSP-blocked before Google's own auth flow ever runs.
  // 'unsafe-eval': heic2any's underlying libheif decoder is Emscripten-
  // compiled WebAssembly, and its generated glue code calls `new Function()`
  // for its WASM dynCall wrappers (confirmed by grepping the actual shipped
  // dist file) — a plain string-to-JS eval, not covered by the narrower
  // 'wasm-unsafe-eval' keyword (that only covers WebAssembly.instantiate()
  // itself). The Worker this runs in (see worker-src below) inherits this
  // page's script-src rather than getting its own, so the restriction has
  // to live here. No safe workaround exists short of not using heic2any at
  // all — this is deep in generated runtime glue, not something the app's
  // own code calls into. Failures here are easy to miss: they throw inside
  // the Worker's own execution context, which doesn't surface through the
  // page's normal console — confirmed only by attaching a CDP session
  // directly to the worker target while debugging this. A narrower
  // trade-off than it looks: this app already accepts 'unsafe-inline' below
  // for the same reason (no dangerouslySetInnerHTML/eval-of-attacker-data
  // anywhere in the app for either to piggyback on).
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://maps.googleapis.com https://www.instagram.com https://*.firebasedatabase.app https://apis.google.com https://accounts.google.com",
  // Without this, `worker-src` isn't its own directive, so per the CSP spec
  // it falls back to script-src — which doesn't allow `blob:` — silently
  // blocking any Worker created from a blob: URL. heic2any (PhotoUploadField's
  // HEIC->JPEG conversion) does exactly that internally (libheif's WASM
  // decoder runs in a Worker sourced from a blob: URL). Reproduced live
  // 2026-09-04: selecting a real HEIC file left "Foto verwerken…" spinning
  // forever, no error ever shown — the browser silently blocked the
  // worker's creation. `blob:` only, no remote origin, since this only
  // ever runs code the app's own bundle constructs client-side.
  "worker-src 'self' blob:",
  // fonts.googleapis.com: NOT this app's own fonts (those are self-hosted
  // via next/font/google at build time) — the rendered Maps widget itself
  // loads its own UI-chrome stylesheets (map control icons/labels) from
  // there once a real map actually renders. Only found by testing against
  // an authorized domain — the Maps key's own referrer restriction (see
  // the pen-test report) meant local dev never got far enough to load them.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' https: data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss://*.firebasedatabase.app",
  // *.firebasedatabase.app: the same RTDB long-polling fallback described
  // under script-src also hosts its poll in a hidden iframe, against a
  // server-assigned shard host (s-gke-euw1-...europe-west1.firebasedatabase.app),
  // not the namespace host — hence the wildcard rather than an exact origin.
  // *.firebaseapp.com + accounts.google.com: the Google sign-in popup/
  // redirect (PLAN-INLOGGEN.md §7) — its OAuth handshake round-trips through
  // Firebase's own /__/auth/handler page on the authDomain (default
  // <project>.firebaseapp.com; wildcarded rather than hardcoded so this
  // doesn't need updating if authDomain ever moves to a 2happies.nl
  // subdomain) and through accounts.google.com's own consent screen.
  "frame-src 'self' https://www.instagram.com https://*.firebasedatabase.app https://*.firebaseapp.com https://accounts.google.com",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Confirmed via a live curl against the deployed site (2026-08-24 pen
  // test) that none of these were being sent at all.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // App Hosting (Cloud Run under the hood) doesn't set this by
          // default the way Firebase Hosting does for prod (confirmed via a
          // live curl 2026-09-02: prod sends max-age=31556926, staging sent
          // nothing at all). 2 years + includeSubDomains + preload, matching
          // the strongest common real-world defaults — this app is
          // HTTPS-only everywhere already (App Hosting forces the redirect),
          // so there's no legitimate plain-HTTP use case this could break.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // No clickjacking surface — this app has no legitimate reason to
          // ever be framed by another site.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Only send the origin cross-site, full URL same-site — avoids
          // leaking full paths (which can carry ids) to third parties.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Explicitly deny browser features this app never uses.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
