"use client";

import { useSyncExternalStore } from "react";
import Script from "next/script";
import { hasAnalyticsConsent } from "@/lib/cookieConsent";

// No real external subscription needed, same as CookieBanner's identical
// helper — consent, once read, doesn't change from outside this component
// during its lifetime.
function subscribeToNothing() {
  return () => {};
}

// Only injects gtag.js when BOTH a measurement id is configured (it isn't,
// in production, as of 2026-09-02 — see GO-LIVE-CHECKLIST.md §7, deliberately
// deferred until the Privacy Policy exists) AND the visitor has actually
// opted into analytics via CookieBanner. The script tag is what starts
// collecting data, so gating it here — not just in the banner's copy — is
// the actual enforcement point.
//
// Known gap: if consent is granted mid-session (clicking "Accepteren" after
// this component already rendered null), analytics only starts on the next
// page load, not immediately — there's no live subscription wiring
// CookieBanner's accept action back to this component. Not worth building
// out further while GA stays dormant; revisit if/when a real measurement id
// is ever set.
export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const analyticsConsent = useSyncExternalStore(
    subscribeToNothing,
    hasAnalyticsConsent,
    /* v8 ignore next -- getServerSnapshot only runs during an actual server render or the
       initial hydration pass; RTL's render() does neither, so this is never invoked here. */
    () => false,
  );

  if (!gaId || !analyticsConsent) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');`}
      </Script>
    </>
  );
}
