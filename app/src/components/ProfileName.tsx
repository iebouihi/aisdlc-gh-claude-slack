import { useState } from "react";
import { validateProfileName } from "@/lib/profile";
import styles from "./HabitList.module.css";

type Props = { name: string; onSave: (name: string) => void };

/** Inline name editor for the Habits view: the name with Edit, or a labelled field with Save and Cancel. */
export function ProfileName({ name, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function start() {
    setDraft(name);
    setError(null);
    setEditing(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const checked = validateProfileName(draft);
    if (checked.error !== null) {
      setError(checked.error);
      return;
    }
    onSave(checked.name);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className={styles.profile}>
        <p className={styles.profileName}>
          <span className={styles.profileLabel}>Your name: </span>
          <span>{name || "Not set"}</span>
        </p>
        <button type="button" className={styles.button} onClick={start}>
          {name ? "Edit" : "Add name"}
        </button>
      </div>
    );
  }

  return (
    <form
      className={styles.profile}
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setEditing(false);
        }
      }}
      noValidate
    >
      <label htmlFor="profile-name" className={styles.profileLabel}>
        Your name (optional)
      </label>
      <div className={styles.addRow}>
        <input
          id="profile-name"
          className={styles.input}
          type="text"
          autoFocus
          value={draft}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "profile-error" : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className={styles.primaryButton}>
          Save
        </button>
        <button type="button" className={styles.button} onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
      {error && (
        <p id="profile-error" role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
