"use client";

import { useEffect, useRef } from "react";
import styles from "./HabitList.module.css";

type Props = { name: string; onConfirm: () => void; onCancel: () => void };

const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

/** Modal confirmation: focus starts inside and is trapped, Escape cancels. */
export function DeleteDialog({ name, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className={styles.backdrop}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
        className={styles.dialog}
        onKeyDown={onKeyDown}
      >
        <h2 id="delete-title" className={styles.dialogTitle}>
          Delete habit?
        </h2>
        <p id="delete-desc">Delete &ldquo;{name}&rdquo;? This is permanent and cannot be undone.</p>
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" className={styles.button} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.dangerButton} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
