import type { DietaryOptions } from "@/types/shops";

export interface DietaryBadge {
  key: keyof DietaryOptions;
  emoji: string;
  label: string;
}

export const DIETARY_BADGES: DietaryBadge[] = [
  { key: "glutenvrij", emoji: "🌾", label: "Glutenvrij" },
  { key: "halal", emoji: "☪️", label: "Halal" },
  { key: "vega", emoji: "🌿", label: "Vega" },
];

export function activeDietaryBadges(options: DietaryOptions | undefined): DietaryBadge[] {
  if (!options) return [];
  return DIETARY_BADGES.filter((b) => options[b.key]);
}
