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
import {
  NOT_SCHEDULED_TEXT,
  isChecked,
  parseCheckins,
  removeCheckInsFor,
  todayStatus,
  todaySummary,
  toggleCheckIn,
  type CheckIn,
} from "@/lib/checkins";
import { iconEmoji } from "@/lib/icons";
import { currentStreak, streakText } from "@/lib/streak";
import {
  formatDate,
  hasEnded,
  hasErrors,
  summarize,
  toLocalDate,
  validateSchedule,
  type ScheduleErrors,
} from "@/lib/schedule";
import { CHECKINS_KEY, HABITS_KEY, readJson, writeJson } from "@/lib/storage";
import { DeleteDialog } from "./DeleteDialog";
import { IconPicker } from "./IconPicker";
import {
  ScheduleFields,
  draftFromSchedule,
  scheduleFromDraft,
  type ScheduleDraft,
} from "./ScheduleFields";
import { WeekView } from "./WeekView";
import styles from "./HabitList.module.css";

const STORAGE_ERROR =
  "Your habits could not be loaded or saved. Changes may be lost when you close this page.";

const CHECKIN_ERROR =
  "Your check-ins could not be loaded or saved. Changes may be lost when you close this page.";

type Editing = {
  id: string;
  name: string;
  icon: string | undefined;
  error: string | null;
  schedule: ScheduleDraft;
  scheduleErrors: ScheduleErrors;
};

/** The add form starts as Daily from today, with no end date. */
function newDraft(): ScheduleDraft {
  return { type: "daily", days: [], startDate: toLocalDate(new Date()), endDate: "" };
}

/** A row's current streak: icon + text, never colour alone; "Ended" for a finished habit. */
function StreakLine({ streak, ended }: { streak: number; ended: boolean }) {
  return (
    <p className={styles.streak}>
      <span aria-hidden="true">{streak > 0 ? "🔥" : "⛓️"}</span>
      {streak > 0 && <span className={styles.visuallyHidden}>Run: </span>}
      <span>{streakText(streak)}</span>
      {ended && <span className={styles.ended}>Ended</span>}
    </p>
  );
}

export function HabitList() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [checkinError, setCheckinError] = useState(false);
  // Local date of "today"; empty until mounted so the static build never bakes in a date.
  const [today, setToday] = useState("");

  const [addName, setAddName] = useState("");
  const [addIcon, setAddIcon] = useState<string | undefined>();
  const [addError, setAddError] = useState<string | null>(null);
  // Start date is empty until mounted, so the static build never bakes in a date.
  const [addSchedule, setAddSchedule] = useState<ScheduleDraft>({
    type: "daily",
    days: [],
    startDate: "",
    endDate: "",
  });
  const [addScheduleErrors, setAddScheduleErrors] = useState<ScheduleErrors>({});

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
    const checkinResult = readJson(CHECKINS_KEY);
    const parsedCheckins = checkinResult.ok ? parseCheckins(checkinResult.value) : null;
    if (parsedCheckins === null) setCheckinError(true);
    else setCheckins(parsedCheckins);
    setToday(toLocalDate(new Date()));
    setAddSchedule(newDraft());
    setLoaded(true);
  }, []);

  // The date can change while the app stays open: refresh on focus and on any interaction (D5).
  useEffect(() => {
    function refresh() {
      const now = toLocalDate(new Date());
      setToday((current) => (current === now ? current : now));
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    document.addEventListener("pointerdown", refresh, true);
    document.addEventListener("keydown", refresh, true);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      document.removeEventListener("pointerdown", refresh, true);
      document.removeEventListener("keydown", refresh, true);
    };
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

  /** Show the new check-ins at once and try to save them; a failed save keeps them for the session. */
  function persistCheckins(next: CheckIn[]) {
    setCheckins(next);
    setCheckinError(!writeJson(CHECKINS_KEY, next).ok);
  }

  function toggle(habitId: string) {
    // Only today can be checked (D3): the date never comes from anywhere else.
    persistCheckins(toggleCheckIn(checkins, habitId, today));
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const error = validateName(addName, habits);
    const schedule = scheduleFromDraft(addSchedule);
    const scheduleErrors = validateSchedule(schedule, toLocalDate(new Date()));
    setAddError(error);
    setAddScheduleErrors(scheduleErrors);
    if (error || hasErrors(scheduleErrors)) return;
    persist(addHabit(habits, addName, addIcon, new Date(), schedule));
    setAddName("");
    setAddIcon(undefined);
    setAddSchedule(newDraft());
    addInputRef.current?.focus();
  }

  function startEdit(habit: Habit) {
    setEditing({
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      error: null,
      schedule: draftFromSchedule(habit),
      scheduleErrors: {},
    });
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
    const schedule = scheduleFromDraft(editing.schedule);
    const original = habits.find((h) => h.id === editing.id);
    const scheduleErrors = validateSchedule(schedule, toLocalDate(new Date()), original);
    if (error || hasErrors(scheduleErrors)) {
      setEditing({ ...editing, error, scheduleErrors });
      return;
    }
    persist(updateHabit(habits, editing.id, editing.name, editing.icon, schedule));
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
    const remaining = removeCheckInsFor(checkins, deleteId);
    if (remaining.length !== checkins.length) persistCheckins(remaining);
    setDeleteId(null);
  }

  const summary = todaySummary(habits, checkins, today);
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
        <ScheduleFields
          idPrefix="add"
          draft={addSchedule}
          errors={addScheduleErrors}
          onChange={(draft) => {
            setAddSchedule(draft);
            setAddScheduleErrors({});
          }}
        />
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

      {/* One alert when all storage is broken: the habits message already says changes may be lost. */}
      {checkinError && !storageError && (
        <p role="alert" className={styles.storageError}>
          {CHECKIN_ERROR}
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

      {loaded && summary.total > 0 && (
        <p className={styles.todaySummary} aria-live="polite">
          {summary.done} of {summary.total} done today
        </p>
      )}

      {loaded && habits.length > 0 && (
        <ul className={styles.list}>
          {habits.map((habit) => {
            const isEditing = editing?.id === habit.id;
            const status = todayStatus(habit, today);
            const done = status === "checkable" && isChecked(checkins, habit.id, today);
            return (
              <li
                key={habit.id}
                ref={isEditing ? editRowRef : undefined}
                data-focus={`row-${habit.id}`}
                tabIndex={-1}
                aria-label={isEditing ? undefined : habit.name}
                className={[
                  styles.row,
                  status === "not-scheduled" ? styles.dimmed : "",
                  done ? styles.done : "",
                ].join(" ")}
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
                    <ScheduleFields
                      idPrefix="edit"
                      draft={editing.schedule}
                      errors={editing.scheduleErrors}
                      onChange={(schedule) =>
                        setEditing({ ...editing, schedule, scheduleErrors: {} })
                      }
                    />
                    {editing.error && (
                      <p id="edit-error" role="alert" className={styles.error}>
                        {editing.error}
                      </p>
                    )}
                  </form>
                ) : (
                  <>
                    {status === "checkable" && (
                      <input
                        type="checkbox"
                        className={styles.check}
                        data-focus={`check-${habit.id}`}
                        aria-label={`Done today: ${habit.name}`}
                        checked={done}
                        onChange={() => toggle(habit.id)}
                      />
                    )}
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
                    {done && <span className={styles.doneLabel}>✓ Done</span>}
                    {status === "not-scheduled" && (
                      <span className={styles.statusLabel}>{NOT_SCHEDULED_TEXT}</span>
                    )}
                    {status === "not-started" && (
                      <span className={styles.statusLabel}>
                        Starts {formatDate(habit.startDate)}
                      </span>
                    )}
                    <p className={styles.summary}>
                      {summarize(habit)}
                      {hasEnded(habit, toLocalDate(new Date())) && (
                        <span className={styles.ended}>Ended {formatDate(habit.endDate!)}</span>
                      )}
                    </p>
                    {!checkinError && today && (
                      <StreakLine
                        streak={currentStreak(habit, checkins, today)}
                        ended={hasEnded(habit, today)}
                      />
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {loaded && (
        <section aria-labelledby="week-heading" className={styles.weekSection}>
          <h2 id="week-heading" className={styles.weekHeading}>
            Week
          </h2>
          <WeekView habits={habits} checkins={checkins} today={today} />
        </section>
      )}

      {habitToDelete && (
        <DeleteDialog name={habitToDelete.name} onConfirm={confirmDelete} onCancel={cancelDelete} />
      )}
    </section>
  );
}
