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
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white" aria-hidden="true">
            <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.24 2.22.4.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.35 1.05.4 2.22.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.24 1.8-.4 2.22-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.05.35-2.22.4-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.24-2.22-.4-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.35-1.05-.4-2.22-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.24-1.8.4-2.22.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.05-.35 2.22-.4 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.39C1.35 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.39 2.13.67.67 1.34 1.08 2.13 1.39.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.39.67-.67 1.08-1.34 1.39-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.39-2.13C21.32 1.35 20.65.94 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.41-10.85a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z" />
          </svg>
        </a>
      )}
    </div>
  );
}
