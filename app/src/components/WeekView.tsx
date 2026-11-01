import type { CheckIn } from "@/lib/checkins";
import type { Habit } from "@/lib/habits";
import { iconEmoji } from "@/lib/icons";
import { STATE_TEXT, summaryText, weekRows, weekWindow, type CellState } from "@/lib/week";
import styles from "./WeekView.module.css";

const ICON: Record<CellState, string> = {
  done: "✓",
  missed: "✗",
  "not-scheduled": "–",
  "not-active": "·",
  pending: "○",
};

const LEGEND = "✓ done · ✗ missed · ○ not done yet · – not scheduled · · not active";

/** Read-only table of the last 7 days per habit. Cells are not interactive. */
export function WeekView({
  habits,
  checkins,
  today,
}: {
  habits: readonly Habit[];
  checkins: readonly CheckIn[];
  today: string;
}) {
  if (habits.length === 0) return <p className={styles.empty}>No habits yet</p>;
  const days = weekWindow(today);
  const rows = weekRows(habits, checkins, today);
  return (
    <div>
      <table className={styles.table}>
        <caption className={styles.caption}>Last 7 days</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.habitHead}>
              Habit
            </th>
            {days.map((d) => (
              <th
                key={d.date}
                scope="col"
                className={d.isToday ? styles.todayHead : styles.dayHead}
                aria-current={d.isToday ? "date" : undefined}
              >
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
    </div>
  );
}
