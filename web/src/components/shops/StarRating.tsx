"use client";

import styles from "./StarRating.module.css";

interface StarRatingProps {
  currentUserRating: number | undefined;
  onRate: (rating: number) => void;
}

const STARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function StarRating({ currentUserRating, onRate }: StarRatingProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.stars}>
        {STARS.map((star) => (
          <button
            key={star}
            type="button"
            className={styles.star}
            aria-label={`Geef ${star} sterren`}
            onClick={() => onRate(star)}
          >
            {star <= (currentUserRating ?? 0) ? "⭐" : "☆"}
          </button>
        ))}
      </div>
      {currentUserRating ? (
        <div className={styles.confirmed}>✓ Je gaf {currentUserRating} sterren</div>
      ) : (
        <div className={styles.hint}>Klik op de sterren om te beoordelen</div>
      )}
    </div>
  );
}
