import { iconEmoji } from "@/lib/icons";
import { insightText, MIN_MOOD_DAYS, NOT_ENOUGH_TEXT, type InsightRow } from "@/lib/mood";
import styles from "./Insights.module.css";

type Props = { result: { logged: number; ready: boolean; rows: InsightRow[] } };

/** Read-only habit/mood insights. The correlation note is always visible (not a tooltip). */
export function Insights({ result }: Props) {
  return (
    <section aria-labelledby="insights-heading" className={styles.insights}>
      <h2 id="insights-heading" className={styles.heading}>
        Insights
      </h2>
      <p className={styles.note}>
        <strong>
          These are patterns in your own data. A link doesn&apos;t mean a habit causes better mood.
        </strong>{" "}
        Days without a check-in count as &quot;not done&quot;.
      </p>
      {!result.ready ? (
        <>
          <p className={styles.progress}>{NOT_ENOUGH_TEXT}</p>
          <p>
            {result.logged} of {MIN_MOOD_DAYS} days logged
          </p>
        </>
      ) : (
        <>
          <p>A plus means a habit tends to go with a better mood on days it is done.</p>
          <ul className={styles.list}>
            {result.rows.map((row) => (
              <li key={row.habitId} className={styles.row}>
                <span className={styles.name}>
                  <span aria-hidden="true">{iconEmoji(row.icon)}</span> {row.name}
                </span>
                <span className={styles.text}>{insightText(row)}</span>
                {row.status !== "not-enough" && (
                  <span className={styles.by}>based on {row.days} days</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
