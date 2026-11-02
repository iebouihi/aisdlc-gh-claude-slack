import styles from "./AppNav.module.css";

export type View = "today" | "week" | "progress" | "habits";

const ITEMS: { view: View; label: string }[] = [
  { view: "today", label: "Today" },
  { view: "week", label: "Week" },
  { view: "progress", label: "Progress" },
  { view: "habits", label: "Habits" },
];

/** Top nav with four items. Switching is in-page state: no route, no reload. */
export function AppNav({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <nav aria-label="Views" className={styles.nav}>
      {ITEMS.map((item) => (
        <button
          key={item.view}
          type="button"
          className={styles.item}
          aria-current={item.view === view ? "page" : undefined}
          onClick={() => onChange(item.view)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
