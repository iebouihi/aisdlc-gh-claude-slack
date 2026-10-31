import { ICON_CATALOG } from "@/lib/icons";
import styles from "./HabitList.module.css";

type Props = {
  /** Id of the selected catalog icon, or undefined for none. */
  value: string | undefined;
  onChange: (icon: string | undefined) => void;
  /** Accessible name of the group, e.g. "Icon (optional)". */
  label: string;
};

/** Keyboard-operable icon picker: one toggle button per catalog icon, each with a text label. */
export function IconPicker({ value, onChange, label }: Props) {
  return (
    <div role="group" aria-label={label} className={styles.picker}>
      {ICON_CATALOG.map((icon) => {
        const selected = value === icon.id;
        return (
          <button
            key={icon.id}
            type="button"
            className={styles.iconOption}
            aria-pressed={selected}
            title={icon.label}
            onClick={() => onChange(selected ? undefined : icon.id)}
          >
            <span aria-hidden="true">{icon.emoji}</span>
            <span className={styles.srOnly}>{icon.label}</span>
          </button>
        );
      })}
    </div>
  );
}
