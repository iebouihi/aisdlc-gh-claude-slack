import { HabitList } from "@/components/HabitList";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className="container">
      <h1 className={styles.title}>Good habit tracker</h1>
      <p className={styles.tagline}>Build better routines, one day at a time.</p>
      <HabitList />
    </main>
  );
}
