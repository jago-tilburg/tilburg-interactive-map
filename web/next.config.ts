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
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://maps.googleapis.com https://www.instagram.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss://*.firebasedatabase.app",
  "frame-src 'self' https://www.instagram.com",
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
