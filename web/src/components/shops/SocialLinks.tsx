"use client";

import { trackEvent } from "@/lib/analytics/trackEvent";
import { isSafeHttpUrl } from "@/lib/safeUrl";
import styles from "./SocialLinks.module.css";

interface SocialLinksProps {
  shopName: string;
  tiktokUrl?: string;
  instagramUrl?: string;
}

export function SocialLinks({ shopName, tiktokUrl, instagramUrl }: SocialLinksProps) {
  const safeTiktokUrl = isSafeHttpUrl(tiktokUrl) ? tiktokUrl : undefined;
  const safeInstagramUrl = isSafeHttpUrl(instagramUrl) ? instagramUrl : undefined;
  if (!safeTiktokUrl && !safeInstagramUrl) return null;

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>Zie mijn review op:</span>
      {safeTiktokUrl && (
        <a
          href={safeTiktokUrl}
          target="_blank"
          rel="noopener"
          className={styles.tiktok}
          title="TikTok"
          onClick={() => trackEvent("click_social_link", { shop_name: shopName, platform: "tiktok" })}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white" aria-hidden="true">
            <path d="M16.6 5.82c-1.12-1.08-1.67-2.64-1.75-4.17V1h-3.4v14.4a2.59 2.59 0 0 1-2.59 2.5c-1.43 0-2.6-1.16-2.6-2.6s1.17-2.6 2.6-2.6c.27 0 .53.04.77.12v-3.47a5.9 5.9 0 0 0-.77-.05A5.99 5.99 0 0 0 3 15.3a5.99 5.99 0 0 0 5.86 6c3.3 0 5.99-2.68 5.99-6V8.36c1.31.94 2.91 1.5 4.65 1.5V6.46c-.99 0-1.94-.24-2.9-.64Z" />
          </svg>
        </a>
      )}
      {safeInstagramUrl && (
        <a
          href={safeInstagramUrl}
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
