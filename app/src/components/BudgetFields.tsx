import { PERIOD_LABEL, type BudgetPeriod, type MoneyDraft, type MoneyErrors } from "@/lib/budget";
import styles from "./HabitList.module.css";

type Props = {
  idPrefix: string;
  draft: MoneyDraft;
  errors: MoneyErrors;
  onChange: (draft: MoneyDraft) => void;
};

/** Optional cost per check-in and optional budget (amount + period); errors inline and announced. */
export function BudgetFields({ idPrefix, draft, errors, onChange }: Props) {
  const costErrorId = `${idPrefix}-cost-error`;
  const budgetErrorId = `${idPrefix}-budget-error`;
  return (
    <div className={styles.schedule}>
      <div className={styles.dates}>
        <label className={styles.dateField}>
          Cost per check-in (optional)
          <input
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={draft.cost}
            aria-invalid={errors.cost ? true : undefined}
            aria-describedby={errors.cost ? costErrorId : undefined}
            onChange={(e) => onChange({ ...draft, cost: e.target.value })}
          />
        </label>
        <label className={styles.dateField}>
          Budget amount (optional)
          <input
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={draft.budgetAmount}
            aria-invalid={errors.budget ? true : undefined}
            aria-describedby={errors.budget ? budgetErrorId : undefined}
            onChange={(e) => onChange({ ...draft, budgetAmount: e.target.value })}
          />
        </label>
        <label className={styles.dateField}>
          Budget period
          <select
            className={styles.input}
            value={draft.period}
            onChange={(e) => onChange({ ...draft, period: e.target.value as BudgetPeriod })}
          >
            {(Object.keys(PERIOD_LABEL) as BudgetPeriod[]).map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {errors.cost && (
        <p id={costErrorId} role="alert" className={styles.error}>
          Cost: {errors.cost}
        </p>
      )}
      {errors.budget && (
        <p id={budgetErrorId} role="alert" className={styles.error}>
          Budget: {errors.budget}
        </p>
      )}
    </div>
  );
}
