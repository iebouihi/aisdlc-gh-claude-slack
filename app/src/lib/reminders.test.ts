import { describe, expect, it } from "vitest";
import { parseHabits, addHabit, updateHabit, type Habit } from "./habits";
import { dismissalKey, dueReminders, toLocalTime } from "./reminders";
import { isReminderTime, summarize } from "./schedule";

// Monday 2 Nov 2026.
const TODAY = "2026-11-02";
const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({
  id,
  name: `Habit ${id}`,
  createdAt: "2026-01-05T12:00:00.000Z",
  frequency: { type: "daily" },
  startDate: "2026-01-05",
  reminderTime: "08:00",
  ...extra,
});
const none = new Set<string>();

describe("reminders", () => {
  it("AC1 (#39): the summary ends with the reminder time only when one is set", () => {
    const base = { frequency: { type: "daily" as const }, startDate: "2026-11-12" };
    expect(summarize({ ...base, reminderTime: "08:00" })).toBe(
      "Daily · from 12 Nov · reminder 08:00",
    );
    expect(summarize(base)).toBe("Daily · from 12 Nov");
  });

  it("AC2 (#39): a due habit is listed once its reminder time is reached", () => {
    expect(dueReminders([habit("1")], [], TODAY, "07:59", none)).toEqual([]);
    expect(dueReminders([habit("1")], [], TODAY, "08:00", none)).toHaveLength(1);
  });

  it("AC3 (#39): clearing the reminder removes it and the habit never alerts", () => {
    const [added] = addHabit([], "Read", undefined, new Date(2026, 10, 2), {
      frequency: { type: "daily" },
      startDate: TODAY,
      reminderTime: "08:00",
    });
    const [cleared] = updateHabit([added], added.id, "Read", undefined, {
      frequency: { type: "daily" },
      startDate: TODAY,
    });
    expect(cleared.reminderTime).toBeUndefined();
    expect(dueReminders([cleared], [], TODAY, "23:59", none)).toEqual([]);
  });

  it("AC4 (#39): done, unscheduled, not started and ended habits never alert", () => {
    const habits = [
      habit("done"),
      habit("sun", { frequency: { type: "weekdays", days: [0] } }),
      habit("future", { startDate: "2026-11-03" }),
      habit("ended", { endDate: "2026-11-01" }),
    ];
    expect(dueReminders(habits, [{ habitId: "done", date: TODAY }], TODAY, "09:00", none)).toEqual(
      [],
    );
  });

  it("AC6 (#39): all habits due together are returned", () => {
    expect(dueReminders([habit("1"), habit("2")], [], TODAY, "08:00", none)).toHaveLength(2);
  });

  it("AC8 (#39): a dismissed habit is not returned again that day", () => {
    const dismissed = new Set([dismissalKey("1", TODAY)]);
    expect(dueReminders([habit("1"), habit("2")], [], TODAY, "09:00", dismissed)).toHaveLength(1);
  });

  it("AC9 (#39): a dismissal from yesterday does not apply today", () => {
    const dismissed = new Set([dismissalKey("1", "2026-11-01")]);
    expect(dueReminders([habit("1")], [], TODAY, "08:00", dismissed)).toHaveLength(1);
  });

  it("AC12 (#39): habits stored without reminderTime load and never alert", () => {
    const parsed = parseHabits([{ id: "1", name: "Read", createdAt: "2026-01-05T12:00:00.000Z" }]);
    expect(parsed).toHaveLength(1);
    expect(dueReminders(parsed!, [], TODAY, "23:59", none)).toEqual([]);
  });

  it("AC13 (#39): a malformed reminderTime is corrupted data", () => {
    for (const bad of ["25:99", "8am", "8:00", "", 800]) {
      expect(parseHabits([{ id: "1", name: "Read", reminderTime: bad }])).toBeNull();
      expect(isReminderTime(bad)).toBe(false);
    }
    expect(parseHabits([{ id: "1", name: "Read", reminderTime: "23:59" }])).toHaveLength(1);
  });

  it("toLocalTime formats the device's local time as HH:mm", () => {
    expect(toLocalTime(new Date(2026, 10, 2, 7, 5))).toBe("07:05");
  });
});
