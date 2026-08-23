import { AccountMenu } from "@/components/auth/AccountMenu";
import { MapExperience } from "@/components/map/MapExperience";
import styles from "./page.module.css";

export default function Home() {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>2happies</span>
        <AccountMenu />
      </header>
      <main className={styles.main}>
        {mapsApiKey ? (
          <MapExperience apiKey={mapsApiKey} />
        ) : (
          <p className={styles.missingKey}>
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set — the map can&apos;t load.
          </p>
        )}
      </main>
    </div>
  );
}
