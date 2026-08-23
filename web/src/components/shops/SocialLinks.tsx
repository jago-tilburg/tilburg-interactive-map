"use client";

import { trackEvent } from "@/lib/analytics/trackEvent";
import styles from "./SocialLinks.module.css";

interface SocialLinksProps {
  shopName: string;
  tiktokUrl?: string;
  instagramUrl?: string;
}

export function SocialLinks({ shopName, tiktokUrl, instagramUrl }: SocialLinksProps) {
  if (!tiktokUrl && !instagramUrl) return null;

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>Zie mijn review op:</span>
      {tiktokUrl && (
        <a
          href={tiktokUrl}
          target="_blank"
          rel="noopener"
          className={styles.tiktok}
          title="TikTok"
          onClick={() => trackEvent("click_social_link", { shop_name: shopName, platform: "tiktok" })}
        >
          🎵
        </a>
      )}
      {instagramUrl && (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener"
          className={styles.instagram}
          title="Instagram"
          onClick={() => trackEvent("click_social_link", { shop_name: shopName, platform: "instagram" })}
        >
          📸
        </a>
      )}
    </div>
  );
}
