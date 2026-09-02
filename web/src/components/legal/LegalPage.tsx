"use client";

import { useRouter } from "next/navigation";
import styles from "./LegalPage.module.css";

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

// Shared shell for /voorwaarden and /privacybeleid — same
// brand-left/back-link-right header pattern as BusinessShell/ProfileShell
// (a "schermvullende page", not a modal, since these are real standalone
// legal documents someone might want to open directly or link to, not
// something that only makes sense reached from inside the app).
export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  const router = useRouter();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.brand}>2happies</span>
        <button type="button" className={styles.backLink} onClick={() => router.push("/")}>
          ← Naar de kaart
        </button>
      </div>
      <div className={styles.content}>
        <h1>{title}</h1>
        <p className={styles.updated}>Laatst bijgewerkt: {lastUpdated}</p>
        <div className={styles.prose}>{children}</div>
      </div>
    </div>
  );
}

// Flags a spot that needs real company data (KVK/BTW/address) before this
// document can actually be published — deliberately visually loud (not just
// a code comment) so it can't be missed in a visual review of the rendered
// page, on top of being called out in the go-live checklist.
export function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className={styles.placeholder}>[{children}]</span>;
}
