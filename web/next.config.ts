import type { NextConfig } from "next";

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
        ],
      },
    ];
  },
};

export default nextConfig;
