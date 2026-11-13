import { CATEGORY_CATALOG, NO_CATEGORY_LABEL } from "@/lib/categories";
import styles from "./HabitList.module.css";

/** Labelled native select (keyboard operable); "" means no category. */
export function CategorySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (category: string) => void;
}) {
  return (
    <div className={styles.dateField}>
      <label htmlFor={id}>Category</label>
      <select
        id={id}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{NO_CATEGORY_LABEL}</option>
        {CATEGORY_CATALOG.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
