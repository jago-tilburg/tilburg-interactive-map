"use client";

import { useSyncExternalStore } from "react";
import Script from "next/script";
import { hasAnalyticsConsent, subscribeToConsentChange } from "@/lib/cookieConsent";

// Only injects gtag.js when BOTH a measurement id is configured (it isn't,
// in production, as of 2026-09-02 — see GO-LIVE-CHECKLIST.md §7, deliberately
// deferred until the Privacy Policy exists) AND the visitor has actually
// opted into analytics via CookieBanner. The script tag is what starts
// collecting data, so gating it here — not just in the banner's copy — is
// the actual enforcement point.
//
// Subscribed to subscribeToConsentChange (not a no-op) specifically so
// clicking "Accepteren" starts collection immediately, in the same session
// — the previous no-op version left this dormant until a full page reload,
// which found staging's GA4 property reporting zero data collection despite
// a correctly configured measurement id (2026-09-04): consent was being
// granted correctly, but nothing ever told this component about it.
export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const analyticsConsent = useSyncExternalStore(
    subscribeToConsentChange,
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
