"use client";

import { useEffect, useRef, useState } from "react";
import {
  addHabit,
  parseHabits,
  removeHabit,
  updateHabit,
  validateName,
  type Habit,
} from "@/lib/habits";
import { iconEmoji } from "@/lib/icons";
import { HABITS_KEY, readJson, writeJson } from "@/lib/storage";
import { DeleteDialog } from "./DeleteDialog";
import { IconPicker } from "./IconPicker";
import styles from "./HabitList.module.css";

const STORAGE_ERROR =
  "Your habits could not be loaded or saved. Changes may be lost when you close this page.";

type Editing = { id: string; name: string; icon: string | undefined; error: string | null };

export function HabitList() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);

  const [addName, setAddName] = useState("");
  const [addIcon, setAddIcon] = useState<string | undefined>();
  const [addError, setAddError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const addInputRef = useRef<HTMLInputElement>(null);
  const editRowRef = useRef<HTMLLIElement | null>(null);
  const pendingFocus = useRef<string | null>(null);

  // Read storage on the client only (static export: no window during the build).
  useEffect(() => {
    const result = readJson(HABITS_KEY);
    const parsed = result.ok ? parseHabits(result.value) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (parsed === null) setStorageError(true);
    else setHabits(parsed);
    setLoaded(true);
  }, []);

  // Move focus after a render, once the target element exists.
  useEffect(() => {
    const selector = pendingFocus.current;
    if (!selector) return;
    pendingFocus.current = null;
    document.querySelector<HTMLElement>(selector)?.focus();
  });

  // Clicking or tabbing away from the row being edited cancels the edit (D18).
  const editingId = editing?.id;
  useEffect(() => {
    if (!editingId) return;
    function away(e: Event) {
      if (editRowRef.current && !editRowRef.current.contains(e.target as Node)) {
        setEditing(null);
      }
    }
    document.addEventListener("pointerdown", away);
    document.addEventListener("focusin", away);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("focusin", away);
    };
  }, [editingId]);

  /** Show the new list at once and try to save it; a failed save keeps the change for the session. */
  function persist(next: Habit[]) {
    setHabits(next);
    setStorageError(!writeJson(HABITS_KEY, next).ok);
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const error = validateName(addName, habits);
    setAddError(error);
    if (error) return;
    persist(addHabit(habits, addName, addIcon));
    setAddName("");
    setAddIcon(undefined);
    addInputRef.current?.focus();
  }

  function startEdit(habit: Habit) {
    setEditing({ id: habit.id, name: habit.name, icon: habit.icon, error: null });
    pendingFocus.current = `[data-focus="edit-input"]`;
  }

  function cancelEdit(returnFocus: boolean) {
    if (returnFocus && editing) pendingFocus.current = `[data-focus="edit-${editing.id}"]`;
    setEditing(null);
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const error = validateName(editing.name, habits, editing.id);
    if (error) {
      setEditing({ ...editing, error });
      return;
    }
    persist(updateHabit(habits, editing.id, editing.name, editing.icon));
    pendingFocus.current = `[data-focus="edit-${editing.id}"]`;
    setEditing(null);
  }

  function openDelete(id: string) {
    setEditing(null);
    setDeleteId(id);
  }

  function cancelDelete() {
    if (deleteId) pendingFocus.current = `[data-focus="delete-${deleteId}"]`;
    setDeleteId(null);
  }

  function confirmDelete() {
    if (!deleteId) return;
    const index = habits.findIndex((h) => h.id === deleteId);
    const next = removeHabit(habits, deleteId);
    const target = next[index] ?? next[index - 1];
    pendingFocus.current = target ? `[data-focus="row-${target.id}"]` : `[data-focus="add-input"]`;
    persist(next);
    setDeleteId(null);
  }

  const habitToDelete = habits.find((h) => h.id === deleteId);

  return (
    <section>
      <form className={styles.addForm} onSubmit={submitAdd} noValidate>
        <div className={styles.addRow}>
          <input
            ref={addInputRef}
            data-focus="add-input"
            className={styles.input}
            type="text"
            aria-label="New habit name"
            placeholder="New habit, e.g. Drink 2L water"
            value={addName}
            aria-invalid={addError ? true : undefined}
            aria-describedby={addError ? "add-error" : undefined}
            onChange={(e) => {
              setAddName(e.target.value);
              setAddError(null);
            }}
          />
          <button type="submit" className={styles.primaryButton}>
            Add
          </button>
        </div>
        <IconPicker value={addIcon} onChange={setAddIcon} label="Icon (optional)" />
        {addError && (
          <p id="add-error" role="alert" className={styles.error}>
            {addError}
          </p>
        )}
      </form>

      {storageError && (
        <p role="alert" className={styles.storageError}>
          {STORAGE_ERROR}
        </p>
      )}

      {loaded && habits.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No habits yet</p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => addInputRef.current?.focus()}
          >
            Add your first habit
          </button>
        </div>
      )}

      {loaded && habits.length > 0 && (
        <ul className={styles.list}>
          {habits.map((habit) => {
            const isEditing = editing?.id === habit.id;
            return (
              <li
                key={habit.id}
                ref={isEditing ? editRowRef : undefined}
                data-focus={`row-${habit.id}`}
                tabIndex={-1}
                aria-label={isEditing ? undefined : habit.name}
                className={styles.row}
              >
                {isEditing && editing ? (
                  <form
                    className={styles.editForm}
                    onSubmit={submitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEdit(true);
                      }
                    }}
                    noValidate
                  >
                    <div className={styles.addRow}>
                      <input
                        data-focus="edit-input"
                        className={styles.input}
                        type="text"
                        aria-label={`Name for ${habit.name}`}
                        value={editing.name}
                        aria-invalid={editing.error ? true : undefined}
                        aria-describedby={editing.error ? "edit-error" : undefined}
                        onChange={(e) =>
                          setEditing({ ...editing, name: e.target.value, error: null })
                        }
                      />
                      <button type="submit" className={styles.primaryButton}>
                        Save
                      </button>
                      <button
                        type="button"
                        className={styles.button}
                        onClick={() => cancelEdit(true)}
                      >
                        Cancel
                      </button>
                    </div>
                    <IconPicker
                      value={editing.icon}
                      onChange={(icon) => setEditing({ ...editing, icon })}
                      label={`Icon for ${habit.name} (optional)`}
                    />
                    {editing.error && (
                      <p id="edit-error" role="alert" className={styles.error}>
                        {editing.error}
                      </p>
                    )}
                  </form>
                ) : (
                  <>
                    <span className={styles.icon} aria-hidden="true">
                      {iconEmoji(habit.icon)}
                    </span>
                    <span className={styles.name}>{habit.name}</span>
                    <button
                      type="button"
                      data-focus={`edit-${habit.id}`}
                      className={styles.button}
                      aria-label={`Edit ${habit.name}`}
                      onClick={() => startEdit(habit)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      data-focus={`delete-${habit.id}`}
                      className={styles.button}
                      aria-label={`Delete ${habit.name}`}
                      onClick={() => openDelete(habit.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {habitToDelete && (
        <DeleteDialog name={habitToDelete.name} onConfirm={confirmDelete} onCancel={cancelDelete} />
      )}
    </section>
  );
}
