import { WEEKDAYS, type Frequency, type Schedule, type ScheduleErrors } from "@/lib/schedule";
import styles from "./HabitList.module.css";

/** Form state of the schedule inputs. Dates are "YYYY-MM-DD" or "" when empty. */
export type ScheduleDraft = {
  type: Frequency["type"];
  days: number[];
  startDate: string;
  endDate: string;
};

export function draftFromSchedule(schedule: Schedule): ScheduleDraft {
  return {
    type: schedule.frequency.type,
    days: schedule.frequency.type === "weekdays" ? schedule.frequency.days : [],
    startDate: schedule.startDate,
    endDate: schedule.endDate ?? "",
  };
}

export function scheduleFromDraft(draft: ScheduleDraft): Schedule {
  const frequency: Frequency =
    draft.type === "daily"
      ? { type: "daily" }
      : { type: "weekdays", days: [...draft.days].sort((a, b) => a - b) };
  const schedule: Schedule = { frequency, startDate: draft.startDate };
  if (draft.endDate) schedule.endDate = draft.endDate;
  return schedule;
}

type Props = {
  /** Unique id prefix, so the add form and an edit form never share ids. */
  idPrefix: string;
  draft: ScheduleDraft;
  errors: ScheduleErrors;
  onChange: (draft: ScheduleDraft) => void;
};

/** Frequency (daily or weekdays), start date and optional end date inputs, all labelled. */
export function ScheduleFields({ idPrefix, draft, errors, onChange }: Props) {
  const startErrorId = `${idPrefix}-start-error`;
  const endErrorId = `${idPrefix}-end-error`;
  const daysErrorId = `${idPrefix}-days-error`;

  function toggleDay(day: number, checked: boolean) {
    const days = checked ? [...draft.days, day] : draft.days.filter((d) => d !== day);
    onChange({ ...draft, days });
  }

  return (
    <div className={styles.schedule}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Frequency</legend>
        <label className={styles.choice}>
          <input
            type="radio"
            name={`${idPrefix}-frequency`}
            checked={draft.type === "daily"}
            onChange={() => onChange({ ...draft, type: "daily" })}
          />
          Daily
        </label>
        <label className={styles.choice}>
          <input
            type="radio"
            name={`${idPrefix}-frequency`}
            checked={draft.type === "weekdays"}
            onChange={() => onChange({ ...draft, type: "weekdays" })}
          />
          Specific weekdays
        </label>
      </fieldset>

      {draft.type === "weekdays" && (
        <fieldset
          className={styles.fieldset}
          aria-describedby={errors.days ? daysErrorId : undefined}
        >
          <legend className={styles.legend}>Days of the week</legend>
          {WEEKDAYS.map((w) => (
            <label key={w.day} className={styles.choice}>
              <input
                type="checkbox"
                checked={draft.days.includes(w.day)}
                aria-label={w.long}
                onChange={(e) => toggleDay(w.day, e.target.checked)}
              />
              <span aria-hidden="true">{w.short}</span>
            </label>
          ))}
          {errors.days && (
            <p id={daysErrorId} role="alert" className={styles.error}>
              {errors.days}
            </p>
          )}
        </fieldset>
      )}

      <div className={styles.dates}>
        <label className={styles.dateField}>
          Start date
          <input
            type="date"
            className={styles.input}
            value={draft.startDate}
            aria-invalid={errors.start ? true : undefined}
            aria-describedby={errors.start ? startErrorId : undefined}
            onChange={(e) => onChange({ ...draft, startDate: e.target.value })}
          />
        </label>
        <label className={styles.dateField}>
          End date (optional)
          <input
            type="date"
            className={styles.input}
            value={draft.endDate}
            aria-invalid={errors.end ? true : undefined}
            aria-describedby={errors.end ? endErrorId : undefined}
            onChange={(e) => onChange({ ...draft, endDate: e.target.value })}
          />
        </label>
      </div>
      {errors.start && (
        <p id={startErrorId} role="alert" className={styles.error}>
          {errors.start}
        </p>
      )}
      {errors.end && (
        <p id={endErrorId} role="alert" className={styles.error}>
          {errors.end}
        </p>
      )}
    </div>
  );
}
