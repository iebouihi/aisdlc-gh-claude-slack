import { useState } from "react";
import type { CheckIn } from "@/lib/checkins";
import type { Habit } from "@/lib/habits";
import { iconEmoji } from "@/lib/icons";
import {
  DEFAULT_PERIOD,
  NO_SCHEDULED_DAYS_TEXT,
  PERIODS,
  figureText,
  progress,
  type Period,
} from "@/lib/progress";
import styles from "./ProgressView.module.css";

const BAR_W = 6;
const GAP = 2;
const GROUP = BAR_W * 2 + GAP + 4;
const CHART_H = 80;

/** Read-only done-vs-expected charts: overall paired bars per day, one progress bar per habit. */
export function ProgressView({
  habits,
  checkins,
  today,
}: {
  habits: readonly Habit[];
  checkins: readonly CheckIn[];
  today: string;
}) {
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  if (habits.length === 0) return <p className={styles.empty}>No habits yet</p>;
  const p = progress(habits, checkins, today, period);
  const periodLabel = PERIODS.find((x) => x.days === period)!.label;
  const withDays = p.rows.filter((r) => r.expected > 0);
  const max = Math.max(1, ...p.perDay.map((d) => d.expected));
  const scale = (n: number) => (n / max) * (CHART_H - 4);
  const width = p.days.length * GROUP;
  const overall = `${figureText(p.done, p.expected)} (${p.percent}%)`;
  const alt = `${periodLabel}: ${overall}. Done and expected habits for each day; see the table.`;

  return (
    <div>
      <div className={styles.periods} role="group" aria-label="Period">
        {PERIODS.map(({ days, label }) => (
          <button
            key={days}
            type="button"
            className={styles.period}
            aria-pressed={days === period}
            onClick={() => setPeriod(days)}
          >
            {label}
          </button>
        ))}
      </div>

      <h3 className={styles.subheading}>Overall</h3>
      {p.expected === 0 ? (
        <p className={styles.note}>{NO_SCHEDULED_DAYS_TEXT}</p>
      ) : (
        <>
          <p className={styles.figure}>{overall}</p>
          <svg
            className={styles.chart}
            viewBox={`0 0 ${width} ${CHART_H + 10}`}
            role="img"
            aria-label={alt}
          >
            <defs>
              <pattern
                id="expected-pattern"
                width="3"
                height="3"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="3" className={styles.patternLine} />
              </pattern>
            </defs>
            {p.perDay.map((d, i) => {
              const x = i * GROUP + 2;
              const eh = scale(d.expected);
              const dh = scale(d.done);
              return (
                <g key={d.date} data-testid="day-bars">
                  <rect
                    className={styles.doneBar}
                    x={x}
                    y={CHART_H - dh}
                    width={BAR_W}
                    height={dh}
                  />
                  <rect
                    className={styles.expectedBar}
                    x={x + BAR_W + GAP}
                    y={CHART_H - eh}
                    width={BAR_W}
                    height={eh}
                  />
                </g>
              );
            })}
            <line className={styles.axis} x1="0" x2={width} y1={CHART_H} y2={CHART_H} />
            <text x="0" y={CHART_H + 8} fontSize="5" fill="currentColor">
              {p.days[0].label}
            </text>
            <text x={width} y={CHART_H + 8} fontSize="5" textAnchor="end" fill="currentColor">
              {p.days[p.days.length - 1].label}
            </text>
          </svg>
          <ul className={styles.legend}>
            <li>
              <span className={`${styles.swatch} ${styles.swatchDone}`} aria-hidden="true" />
              Done (solid)
            </li>
            <li>
              <span className={`${styles.swatch} ${styles.swatchExpected}`} aria-hidden="true" />
              Expected (striped)
            </li>
          </ul>
          <table className={styles.srOnly}>
            <caption>{`Done and expected habits per day, ${periodLabel}`}</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Done</th>
                <th scope="col">Expected</th>
              </tr>
            </thead>
            <tbody>
              {p.perDay.map((d, i) => (
                <tr key={d.date}>
                  <th scope="row">{p.days[i].isToday ? `${d.date} (today)` : d.date}</th>
                  <td>{d.done}</td>
                  <td>{d.expected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3 className={styles.subheading}>Per habit</h3>
      <ul className={styles.habits}>
        {p.rows.map((r) => (
          <li key={r.habit.id} className={styles.habit}>
            <span className={styles.habitName}>
              <span aria-hidden="true">{iconEmoji(r.habit.icon)}</span> {r.habit.name}
            </span>
            {r.expected === 0 ? (
              <span className={styles.note}> {NO_SCHEDULED_DAYS_TEXT}</span>
            ) : (
              <>
                <div className={styles.figure}>
                  {figureText(r.done, r.expected)} · {r.percent}%
                </div>
                <div
                  className={styles.track}
                  role="progressbar"
                  aria-label={`${r.habit.name}: ${figureText(r.done, r.expected)}`}
                  aria-valuemin={0}
                  aria-valuemax={r.expected}
                  aria-valuenow={r.done}
                >
                  <div className={styles.fill} style={{ width: `${r.percent}%` }} />
                </div>
                {r.todayPending && <div className={styles.note}>Today: not done yet</div>}
              </>
            )}
          </li>
        ))}
      </ul>
      {withDays.length > 0 && (
        <table className={styles.srOnly}>
          <caption>{`Done and expected per habit, ${periodLabel}`}</caption>
          <thead>
            <tr>
              <th scope="col">Habit</th>
              <th scope="col">Done</th>
              <th scope="col">Expected</th>
              <th scope="col">Percent</th>
            </tr>
          </thead>
          <tbody>
            {withDays.map((r) => (
              <tr key={r.habit.id}>
                <th scope="row">{r.habit.name}</th>
                <td>{r.done}</td>
                <td>{r.expected}</td>
                <td>{r.percent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
