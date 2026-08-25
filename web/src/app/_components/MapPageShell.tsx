import { MapExperience, type InitialSelection } from "@/components/map/MapExperience";
import styles from "../page.module.css";

interface MapPageShellProps {
  initialSelection?: InitialSelection;
}

// Shared by / and the /shop/[id], /event/[id], /umbrella/[id] deep-link
// routes so the "Maps key missing" fallback isn't duplicated across all
// four page.tsx files.
export function MapPageShell({ initialSelection }: MapPageShellProps) {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  return (
    <div className={styles.page}>
      {mapsApiKey ? (
        <MapExperience apiKey={mapsApiKey} initialSelection={initialSelection} />
      ) : (
        <p className={styles.missingKey}>
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set — the map can&apos;t load.
        </p>
      )}
    </div>
  );
}
