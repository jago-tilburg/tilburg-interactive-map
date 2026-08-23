import { AccountMenu } from "@/components/auth/AccountMenu";
import styles from "./page.module.css";

// Placeholder landing page for this phase — the map/shop UI is a separate
// porting domain (out of scope here). This page exists to host AccountMenu
// so the auth/account port can be verified end-to-end against a real
// deployed URL.
export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>2happies</span>
        <AccountMenu />
      </header>
      <main className={styles.main}>
        <p>Next.js rewrite in progress — map/shop features not yet ported.</p>
      </main>
    </div>
  );
}
