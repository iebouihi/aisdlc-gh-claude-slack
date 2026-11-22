import { useState } from "react";
import { STARTER_HABITS } from "@/lib/firstRun";
import { iconEmoji } from "@/lib/icons";
import { validateProfileName } from "@/lib/profile";
import styles from "./HabitList.module.css";

type Props = {
  onFinish: (name: string, selectedIds: string[]) => void;
  onSkip: () => void;
};

/** One-time setup screen: optional name, optional starter habits, "Get started" or "Skip". */
export function FirstRunSetup({ onFinish, onSkip }: Props) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const checked = validateProfileName(name);
    if (checked.error !== null) {
      setError(checked.error);
      return;
    }
    onFinish(
      checked.name,
      STARTER_HABITS.filter((h) => selected.has(h.id)).map((h) => h.id),
    );
  }

  return (
    <div className={styles.setup}>
      <h2 className={styles.setupTitle}>Welcome to Good Habit Tracker</h2>
      <p className={styles.setupIntro}>
        Tell us your name and pick a few habits to start with. You can change everything later.
      </p>
      <form className={styles.setupForm} onSubmit={submit} noValidate>
        <div className={styles.setupField}>
          <label htmlFor="setup-name" className={styles.profileLabel}>
            Your name (optional)
          </label>
          <input
            id="setup-name"
            className={styles.input}
            type="text"
            autoFocus
            value={name}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "setup-name-error" : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
          {error && (
            <p id="setup-name-error" role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </div>
        <fieldset className={styles.setupHabits}>
          <legend className={styles.profileLabel}>Pick starter habits (optional)</legend>
          {STARTER_HABITS.map((habit) => (
            <label key={habit.id} className={styles.setupHabit}>
              <input
                type="checkbox"
                checked={selected.has(habit.id)}
                onChange={() => toggle(habit.id)}
              />
              <span aria-hidden="true">{iconEmoji(habit.icon)}</span>
              <span>{habit.name}</span>
            </label>
          ))}
        </fieldset>
        <div className={styles.setupActions}>
          <button type="submit" className={styles.primaryButton}>
            Get started
          </button>
          <button type="button" className={styles.button} onClick={onSkip}>
            Skip
          </button>
        </div>
      </form>
    </div>
  );
}
