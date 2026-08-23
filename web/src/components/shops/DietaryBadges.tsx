import { activeDietaryBadges } from "@/lib/shops/socialAndDietary";
import type { DietaryOptions } from "@/types/shops";
import styles from "./DietaryBadges.module.css";

export function DietaryBadges({ options }: { options: DietaryOptions | undefined }) {
  const badges = activeDietaryBadges(options);
  if (badges.length === 0) return null;
  return (
    <>
      {badges.map((b) => (
        <span key={b.key} className={styles.badge} title={b.label}>
          {b.emoji}
        </span>
      ))}
    </>
  );
}
