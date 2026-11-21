"use client";

import { useEffect, useRef, useState } from "react";
import type { CheckIn } from "@/lib/checkins";
import type { Habit } from "@/lib/habits";
import { iconEmoji } from "@/lib/icons";
import {
  MONTH_SHORT,
  STATE_TEXT,
  WINDOW_DAYS,
  earliestDate,
  rangeLabel,
  shiftDate,
  summaryText,
  weekRows,
  weekWindow,
  windowBounds,
  type CellState,
} from "@/lib/week";
import styles from "./WeekView.module.css";

const ICON: Record<CellState, string> = {
  done: "✓",
  missed: "✗",
  "not-scheduled": "–",
  "not-active": "·",
  pending: "○",
};

const LEGEND = "✓ done · ✗ missed · ○ not done yet · – not scheduled · · not active";
const NO_HABITS_IN_WEEK = "No habits in this week";

const monthOf = (date: string) => Number(date.slice(5, 7)) - 1;

/**
 * Read-only table of a rolling 7-day window per habit, with Previous/Next week navigation.
 * The window is kept as its end date (null = current), in memory only: it resets when the view unmounts.
 */
export function WeekView({
  habits,
  checkins,
  today,
}: {
  habits: readonly Habit[];
  checkins: readonly CheckIn[];
  today: string;
}) {
  const [end, setEnd] = useState<string | null>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  const effectiveEnd = end !== null && end < today ? end : today;
  const { canPrev, canNext } = windowBounds(effectiveEnd, today, earliestDate(habits, checkins));

  // A pressed button may become disabled: move focus to the other one so it is not lost.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const active = document.activeElement as HTMLButtonElement | null;
    if (active === document.body || active?.disabled) {
      (canPrev ? prevRef.current : nextRef.current)?.focus();
    }
  });

  if (habits.length === 0) return <p className={styles.empty}>No habits yet</p>;

  const days = weekWindow(effectiveEnd, today);
  const rows = weekRows(habits, checkins, today, effectiveEnd);
  const label = rangeLabel(days, today);
  const go = (delta: number) => {
    moved.current = true;
    const next = shiftDate(effectiveEnd, delta);
    setEnd(next >= today ? null : next);
  };

  return (
    <div>
      <div className={styles.nav}>
        <button
          ref={prevRef}
          type="button"
          className={styles.navButton}
          disabled={!canPrev}
          onClick={() => go(-WINDOW_DAYS)}
        >
          Previous week
        </button>
        <p className={styles.range} aria-live="polite">
          {label}
        </p>
        <button
          ref={nextRef}
          type="button"
          className={styles.navButton}
          disabled={!canNext}
          onClick={() => go(WINDOW_DAYS)}
        >
          Next week
        </button>
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>{NO_HABITS_IN_WEEK}</p>
      ) : (
        <>
          <table className={styles.table}>
            <caption className={styles.caption}>{label}</caption>
            <thead>
              <tr>
                <th scope="col" className={styles.habitHead}>
                  Habit
                </th>
                {days.map((d, i) => (
                  <th
                    key={d.date}
                    scope="col"
                    className={d.isToday ? styles.todayHead : styles.dayHead}
                    aria-current={d.isToday ? "date" : undefined}
                  >
                    {(i === 0 || monthOf(d.date) !== monthOf(days[i - 1].date)) && (
                      <span className={styles.monthMark}>{MONTH_SHORT[monthOf(d.date)]}</span>
                    )}
                    <span>{d.weekday}</span> <span>{d.day}</span>
                    {d.isToday && <span className={styles.todayMark}>Today</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ habit, cells, ...counts }) => (
                <tr key={habit.id}>
                  <th scope="row" className={styles.habitCell}>
                    <span aria-hidden="true">{iconEmoji(habit.icon)}</span> {habit.name}
                    <span className={styles.summary}>{summaryText(counts)}</span>
                  </th>
                  {cells.map((cell, i) => (
                    <td
                      key={cell.date}
                      className={`${styles.cell} ${styles[cell.state]} ${days[i].isToday ? styles.todayCell : ""}`}
                    >
                      <span aria-hidden="true">{ICON[cell.state]}</span>
                      <span className={styles.srOnly}>
                        {`${habit.name}, ${days[i].weekday} ${days[i].day}: ${STATE_TEXT[cell.state]}`}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.legend}>{LEGEND}</p>
        </>
      )}
    </div>
  );
}
