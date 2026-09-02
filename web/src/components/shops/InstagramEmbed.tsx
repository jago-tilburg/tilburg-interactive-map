"use client";

import { useEffect } from "react";
import { getInstagramEmbedUrl } from "@/lib/shops/instagramEmbed";
import { loadInstagramEmbed } from "@/lib/shops/loadInstagramEmbed";
import styles from "./InstagramEmbed.module.css";

interface InstagramEmbedProps {
  instagramUrl?: string;
}

// Live embed on every viewport — a mobile-only link-out card used to render
// here instead (the live embed was considered "heavy/fragile" on mobile,
// mirroring the prototype's own reasoning), but the whole point of this
// component is to let a visitor watch the post without leaving the app, and
// that matters at least as much on a phone as on desktop.
export function InstagramEmbed({ instagramUrl }: InstagramEmbedProps) {
  const embedUrl = getInstagramEmbedUrl(instagramUrl);

  useEffect(() => {
    if (!embedUrl) return;
    let cancelled = false;
    loadInstagramEmbed()
      .then(() => {
        if (!cancelled) window.instgrm?.Embeds.process();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [embedUrl]);

  if (!embedUrl) {
    return <p className={styles.placeholder}>📷 Geen Instagram post beschikbaar</p>;
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
