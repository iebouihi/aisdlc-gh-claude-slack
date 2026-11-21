import { MOOD_LEVELS, type MoodValue } from "@/lib/mood";
import styles from "./MoodPicker.module.css";

type Props = {
  days: { offset: number; date: string; label: string }[];
  dayIndex: number;
  onDay: (offset: number) => void;
  value?: MoodValue;
  onSelect: (value: MoodValue) => void;
  onClear: () => void;
};

/** One-tap mood for the selected day: native radios, a labelled day select, a Clear button. */
export function MoodPicker({ days, dayIndex, onDay, value, onSelect, onClear }: Props) {
  return (
    <fieldset className={styles.mood}>
      <legend className={styles.legend}>How is your mood?</legend>
      <label className={styles.day}>
        Day
        <select
          className={styles.select}
          value={dayIndex}
          onChange={(e) => onDay(Number(e.target.value))}
        >
          {days.map((d) => (
            <option key={d.offset} value={d.offset}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.levels}>
        {MOOD_LEVELS.map((level) => (
          <label key={level.value} className={styles.level}>
            <input
              type="radio"
              name="mood"
              className={styles.radio}
              checked={value === level.value}
              onChange={() => onSelect(level.value)}
            />
            <span aria-hidden="true">{level.emoji}</span>
            <span>{level.label}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className={styles.clear}
        disabled={value === undefined}
        onClick={onClear}
      >
        Clear
      </button>
    </fieldset>
  );
}
