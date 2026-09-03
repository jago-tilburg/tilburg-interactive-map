"use client";

import { useRouter } from "next/navigation";
import styles from "./PageHeader.module.css";

// Shared header for every non-map page (/profiel, /eventbeheer,
// /voorwaarden, /privacybeleid) — same green→orange gradient bar as the
// map's own Header.tsx (--header-gradient), so navigating away from the map
// doesn't drop into a visually different, less-finished-looking app.
// Previously each page duplicated this exact brand+back-link markup with
// its own plain-white header CSS; now one shared component/style.
export function PageHeader() {
  const router = useRouter();

  return (
    <div className={styles.header}>
      <span className={styles.brand}>2happies</span>
      <button type="button" className={styles.backLink} onClick={() => router.push("/")}>
        ← Naar de kaart
      </button>
    </div>
  );
}
