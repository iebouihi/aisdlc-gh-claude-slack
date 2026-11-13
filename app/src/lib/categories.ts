/** Fixed built-in habit categories (no custom ones). Pure, no React. */
export const CATEGORY_CATALOG = [
  { id: "health", label: "Health" },
  { id: "fitness", label: "Fitness" },
  { id: "work", label: "Work" },
  { id: "learning", label: "Learning" },
  { id: "home", label: "Home" },
  { id: "finance", label: "Finance" },
  { id: "social", label: "Social" },
  { id: "other", label: "Other" },
] as const;

export const UNCATEGORISED_LABEL = "Uncategorised";
export const NO_CATEGORY_LABEL = "No category";

export function findCategory(id: unknown): { id: string; label: string } | undefined {
  return CATEGORY_CATALOG.find((c) => c.id === id);
}
