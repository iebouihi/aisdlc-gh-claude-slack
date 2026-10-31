/** Fixed catalog of built-in emoji icons for habits. No uploads, no network. */

export type HabitIcon = { id: string; emoji: string; label: string };

export const ICON_CATALOG: readonly HabitIcon[] = [
  { id: "water", emoji: "💧", label: "Water" },
  { id: "book", emoji: "📖", label: "Book" },
  { id: "run", emoji: "🏃", label: "Run" },
  { id: "sleep", emoji: "😴", label: "Sleep" },
  { id: "meditate", emoji: "🧘", label: "Meditate" },
  { id: "workout", emoji: "🏋️", label: "Workout" },
  { id: "bike", emoji: "🚴", label: "Bike" },
  { id: "swim", emoji: "🏊", label: "Swim" },
  { id: "apple", emoji: "🍎", label: "Healthy food" },
  { id: "salad", emoji: "🥗", label: "Salad" },
  { id: "tea", emoji: "🍵", label: "Tea" },
  { id: "write", emoji: "✍️", label: "Write" },
  { id: "study", emoji: "🎓", label: "Study" },
  { id: "music", emoji: "🎵", label: "Music" },
  { id: "code", emoji: "💻", label: "Code" },
  { id: "art", emoji: "🎨", label: "Art" },
  { id: "clean", emoji: "🧹", label: "Clean" },
  { id: "plant", emoji: "🌱", label: "Plant" },
  { id: "walk", emoji: "🚶", label: "Walk" },
  { id: "money", emoji: "💰", label: "Money" },
  { id: "phone", emoji: "📵", label: "No phone" },
  { id: "teeth", emoji: "🦷", label: "Teeth" },
  { id: "pill", emoji: "💊", label: "Medicine" },
  { id: "heart", emoji: "❤️", label: "Heart" },
];

/** Neutral icon shown for habits without a (valid) icon. */
export const DEFAULT_ICON_EMOJI = "⚪";

export function findIcon(id: string | undefined): HabitIcon | undefined {
  return ICON_CATALOG.find((icon) => icon.id === id);
}

/** The emoji to display for an icon id; unknown or missing ids give the default icon. */
export function iconEmoji(id: string | undefined): string {
  return findIcon(id)?.emoji ?? DEFAULT_ICON_EMOJI;
}
