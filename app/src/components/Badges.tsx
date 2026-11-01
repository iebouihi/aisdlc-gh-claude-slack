import { BADGES, type EarnedBadge } from "@/lib/badges";
import { formatDate } from "@/lib/schedule";
import styles from "./Badges.module.css";

type Props = { earned: readonly EarnedBadge[]; newIds: readonly string[] };

/**
 * Read-only badges: logo (decorative), name, rule and a text state; never colour alone.
 * Plain groups, not a list, so they stay out of the habit list's `listitem` queries.
 */
export function Badges({ earned, newIds }: Props) {
  return (
    <div className={styles.list}>
      {BADGES.map((badge) => {
        const entry = earned.find((e) => e.badgeId === badge.id);
        return (
          <div
            key={badge.id}
            role="group"
            aria-label={badge.name}
            className={[styles.badge, entry ? styles.earned : styles.locked].join(" ")}
          >
            <span className={styles.logo} aria-hidden="true">
              {badge.logo}
            </span>
            <span className={styles.name}>{badge.name}</span>
            <span className={styles.state}>
              {entry ? `Earned on ${formatDate(entry.earnedAt)}` : "Locked"}
            </span>
            {!entry && <span className={styles.rule}>{badge.rule}</span>}
            {entry && newIds.includes(badge.id) && (
              <span aria-live="polite" className={styles.newLabel}>
                New
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
