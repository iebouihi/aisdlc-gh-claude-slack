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
import { awardBadges, newBadgeIds, parseBadges, type Badge, type EarnedBadge } from "@/lib/badges";
import { latestBadge, parseProfile, welcomeText } from "@/lib/profile";
import { iconEmoji } from "@/lib/icons";
import {
  budgetStatus,
  draftFromMoney,
  emptyMoneyDraft,
  hasMoneyErrors,
  overText,
  spentText,
  validateMoney,
  type MoneyDraft,
  type MoneyErrors,
} from "@/lib/budget";
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
import {
  BADGES_KEY,
  CHECKINS_KEY,
  HABITS_KEY,
  PROFILE_KEY,
  readJson,
  writeJson,
} from "@/lib/storage";
import { AppNav, type View } from "./AppNav";
import { Badges } from "./Badges";
import { BudgetFields } from "./BudgetFields";
import { DeleteDialog } from "./DeleteDialog";
import { IconPicker } from "./IconPicker";
import { ProfileName } from "./ProfileName";
import {
  ScheduleFields,
  draftFromSchedule,
  scheduleFromDraft,
  type ScheduleDraft,
} from "./ScheduleFields";
import { ProgressView } from "./ProgressView";
import { WeekView } from "./WeekView";
import styles from "./HabitList.module.css";

const STORAGE_ERROR =
  "Your habits could not be loaded or saved. Changes may be lost when you close this page.";

const CHECKIN_ERROR =
  "Your check-ins could not be loaded or saved. Changes may be lost when you close this page.";

const BADGE_ERROR =
  "Your badges could not be loaded or saved. Changes may be lost when you close this page.";

const PROFILE_ERROR =
  "Your name could not be loaded or saved. Changes may be lost when you close this page.";

type Editing = {
  id: string;
  name: string;
  icon: string | undefined;
  error: string | null;
  schedule: ScheduleDraft;
  scheduleErrors: ScheduleErrors;
  money: MoneyDraft;
  moneyErrors: MoneyErrors;
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

/** Spent of budget for the current period; over budget adds an icon and text, never colour alone. */
function BudgetLine({
  habit,
  checkins,
  today,
}: {
  habit: Habit;
  checkins: CheckIn[];
  today: string;
}) {
  const status = budgetStatus(habit, checkins, today);
  if (!status) return null;
  return (
    <p className={styles.budget}>
      <span>{spentText(status)}</span>
      {status.over > 0 && (
        <span className={styles.over}>
          <span aria-hidden="true">⚠️</span> {overText(status)}
        </span>
      )}
    </p>
  );
}

export function HabitList() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [checkinError, setCheckinError] = useState(false);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [badgeError, setBadgeError] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileError, setProfileError] = useState(false);
  // Badge shown in the welcome: fixed at load, so earning one during the visit changes nothing (D8).
  const [welcomeBadge, setWelcomeBadge] = useState<Badge | null>(null);
  // Badges earned during this visit; in memory only, so "New" disappears on the next load.
  const [newIds, setNewIds] = useState<string[]>([]);
  // Local date of "today"; empty until mounted so the static build never bakes in a date.
  const [today, setToday] = useState("");
  // Which view is shown; in-page state only (no route, nothing stored). Starts on Today.
  const [view, setView] = useState<View>("today");

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
  const [addMoney, setAddMoney] = useState<MoneyDraft>(emptyMoneyDraft());
  const [addMoneyErrors, setAddMoneyErrors] = useState<MoneyErrors>({});

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
    const now = toLocalDate(new Date());
    const badgeResult = readJson(BADGES_KEY);
    const parsedBadges = badgeResult.ok ? parseBadges(badgeResult.value) : null;
    if (parsedBadges === null) {
      // Show all locked and leave the stored value alone until the user saves a change (D10).
      setBadgeError(true);
    } else {
      const awarded = awardBadges(parsedBadges, parsed ?? [], parsedCheckins ?? [], now);
      setBadges(awarded);
      setWelcomeBadge(latestBadge(awarded));
      const added = newBadgeIds(parsedBadges, awarded);
      if (added.length > 0) {
        setNewIds(added);
        setBadgeError(!writeJson(BADGES_KEY, awarded).ok);
      }
    }
    // A corrupted profile shows "Welcome" and stays untouched until the user saves a name (D10).
    const profileResult = readJson(PROFILE_KEY);
    const parsedProfile = profileResult.ok ? parseProfile(profileResult.value) : null;
    if (parsedProfile === null) setProfileError(true);
    else setProfileName(parsedProfile);
    setToday(now);
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

  function saveProfileName(name: string) {
    setProfileName(name);
    setProfileError(!writeJson(PROFILE_KEY, { name }).ok);
  }

  function toggle(habitId: string) {
    // Only today can be checked (D3): the date never comes from anywhere else.
    const next = toggleCheckIn(checkins, habitId, today);
    persistCheckins(next);
    // Badges are only ever added; unchecking never removes one. After a corrupted read the
    // list starts empty, and this save overwrites the corrupted value.
    const awarded = awardBadges(badges, habits, next, today);
    const added = newBadgeIds(badges, awarded);
    if (added.length > 0) {
      setBadges(awarded);
      setNewIds((ids) => [...ids, ...added]);
      setBadgeError(!writeJson(BADGES_KEY, awarded).ok);
    }
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const error = validateName(addName, habits);
    const schedule = scheduleFromDraft(addSchedule);
    const scheduleErrors = validateSchedule(schedule, toLocalDate(new Date()));
    setAddError(error);
    setAddScheduleErrors(scheduleErrors);
    const { errors: moneyErrors, money } = validateMoney(addMoney);
    setAddMoneyErrors(moneyErrors);
    if (error || hasErrors(scheduleErrors) || hasMoneyErrors(moneyErrors)) return;
    persist(addHabit(habits, addName, addIcon, new Date(), schedule, money));
    setAddName("");
    setAddIcon(undefined);
    setAddSchedule(newDraft());
    setAddMoney(emptyMoneyDraft());
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
      money: draftFromMoney(habit),
      moneyErrors: {},
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
    const { errors: moneyErrors, money } = validateMoney(editing.money);
    if (error || hasErrors(scheduleErrors) || hasMoneyErrors(moneyErrors)) {
      setEditing({ ...editing, error, scheduleErrors, moneyErrors });
      return;
    }
    persist(updateHabit(habits, editing.id, editing.name, editing.icon, schedule, money));
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
      <AppNav view={view} onChange={setView} />

      {loaded && view === "habits" && <ProfileName name={profileName} onSave={saveProfileName} />}

      {view === "habits" && (
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
          <BudgetFields
            idPrefix="add"
            draft={addMoney}
            errors={addMoneyErrors}
            onChange={(draft) => {
              setAddMoney(draft);
              setAddMoneyErrors({});
            }}
          />
          {addError && (
            <p id="add-error" role="alert" className={styles.error}>
              {addError}
            </p>
          )}
        </form>
      )}

      {loaded && view === "today" && (
        <div className={styles.welcome}>
          <h2 className={styles.welcomeHeading}>{welcomeText(profileName)}</h2>
          {welcomeBadge && (
            <p className={styles.welcomeBadge}>
              <span aria-hidden="true">{welcomeBadge.logo}</span> {welcomeBadge.name}
            </p>
          )}
        </div>
      )}

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

      {badgeError && !storageError && !checkinError && (
        <p role="alert" className={styles.storageError}>
          {BADGE_ERROR}
        </p>
      )}

      {profileError && !storageError && !checkinError && !badgeError && (
        <p role="alert" className={styles.storageError}>
          {PROFILE_ERROR}
        </p>
      )}

      {loaded && habits.length === 0 && view !== "week" && view !== "progress" && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No habits yet</p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              if (view === "today") {
                pendingFocus.current = `[data-focus="add-input"]`;
                setView("habits");
              } else {
                addInputRef.current?.focus();
              }
            }}
          >
            Add your first habit
          </button>
        </div>
      )}

      {loaded && view === "today" && summary.total > 0 && (
        <p className={styles.todaySummary} aria-live="polite">
          {summary.done} of {summary.total} done today
        </p>
      )}

      {loaded && view !== "week" && view !== "progress" && habits.length > 0 && (
        <ul className={styles.list}>
          {habits.map((habit) => {
            const isEditing = view === "habits" && editing?.id === habit.id;
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
                  view === "today" && done ? styles.done : "",
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
                    <BudgetFields
                      idPrefix="edit"
                      draft={editing.money}
                      errors={editing.moneyErrors}
                      onChange={(money) => setEditing({ ...editing, money, moneyErrors: {} })}
                    />
                    {editing.error && (
                      <p id="edit-error" role="alert" className={styles.error}>
                        {editing.error}
                      </p>
                    )}
                  </form>
                ) : (
                  <>
                    {view === "today" && status === "checkable" && (
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
                    {view === "habits" && (
                      <>
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
                    {view === "today" && done && <span className={styles.doneLabel}>✓ Done</span>}
                    {view === "today" && status === "not-scheduled" && (
                      <span className={styles.statusLabel}>{NOT_SCHEDULED_TEXT}</span>
                    )}
                    {view === "today" && status === "not-started" && (
                      <span className={styles.statusLabel}>
                        Starts {formatDate(habit.startDate)}
                      </span>
                    )}
                    {view === "habits" && (
                      <p className={styles.summary}>
                        {summarize(habit)}
                        {hasEnded(habit, toLocalDate(new Date())) && (
                          <span className={styles.ended}>Ended {formatDate(habit.endDate!)}</span>
                        )}
                      </p>
                    )}
                    {view === "habits" && (
                      <BudgetLine habit={habit} checkins={checkins} today={today} />
                    )}
                    {view === "today" && !checkinError && today && (
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

      {loaded && view === "week" && (
        <section aria-labelledby="week-heading" className={styles.weekSection}>
          <h2 id="week-heading" className={styles.weekHeading}>
            Week
          </h2>
          <WeekView habits={habits} checkins={checkins} today={today} />
        </section>
      )}

      {loaded && view === "progress" && (
        <section aria-labelledby="progress-heading" className={styles.weekSection}>
          <h2 id="progress-heading" className={styles.weekHeading}>
            Progress
          </h2>
          <ProgressView habits={habits} checkins={checkins} today={today} />
        </section>
      )}

      {loaded && view === "today" && (
        <section aria-labelledby="badges-heading" className={styles.weekSection}>
          <h2 id="badges-heading" className={styles.weekHeading}>
            Badges
          </h2>
          <Badges earned={badges} newIds={newIds} />
        </section>
      )}

      {habitToDelete && (
        <DeleteDialog name={habitToDelete.name} onConfirm={confirmDelete} onCancel={cancelDelete} />
      )}
    </section>
  );
}
