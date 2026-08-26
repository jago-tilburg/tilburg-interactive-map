import { MapExperience, type InitialSelection } from "@/components/map/MapExperience";
import styles from "../page.module.css";

interface MapPageShellProps {
  initialSelection?: InitialSelection;
  // Set only by /event/[id] — a return trip from Stripe Checkout. Read
  // server-side there (not via useSearchParams client-side) specifically
  // so this doesn't force / (currently statically rendered) to opt out of
  // static generation too.
  paymentStatus?: "success" | "cancelled";
}

// Shared by / and the /shop/[id], /event/[id], /umbrella/[id] deep-link
// routes so the "Maps key missing" fallback isn't duplicated across all
// four page.tsx files.
export function MapPageShell({ initialSelection, paymentStatus }: MapPageShellProps) {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  return (
    <div className={styles.page}>
      {mapsApiKey ? (
        <MapExperience apiKey={mapsApiKey} initialSelection={initialSelection} paymentStatus={paymentStatus} />
      ) : (
        <p className={styles.missingKey}>
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set — the map can&apos;t load.
        </p>
      )}
    </div>
  );
}
