"use client";

import { useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getInstagramEmbedUrl } from "@/lib/shops/instagramEmbed";
import { loadInstagramEmbed } from "@/lib/shops/loadInstagramEmbed";
import styles from "./InstagramEmbed.module.css";

interface InstagramEmbedProps {
  instagramUrl?: string;
}

export function InstagramEmbed({ instagramUrl }: InstagramEmbedProps) {
  const isMobile = useIsMobile();
  const embedUrl = getInstagramEmbedUrl(instagramUrl);

  useEffect(() => {
    if (!embedUrl || isMobile) return;
    let cancelled = false;
    loadInstagramEmbed()
      .then(() => {
        if (!cancelled) window.instgrm?.Embeds.process();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [embedUrl, isMobile]);

  if (!embedUrl) {
    return <p className={styles.placeholder}>📷 Geen Instagram post beschikbaar</p>;
  }

  if (isMobile) {
    return (
      <a href={embedUrl} target="_blank" rel="noopener" className={styles.liteCard}>
        📸 Bekijk op Instagram
      </a>
    );
  }

  return (
    <div className={styles.embedWrapper}>
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={embedUrl}
        data-instgrm-version="14"
      />
    </div>
  );
}
