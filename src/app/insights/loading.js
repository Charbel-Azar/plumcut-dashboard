import Sidebar from "@/components/Sidebar/Sidebar";
import styles from "./insights.module.css";
import skeleton from "./insights-skeleton.module.css";

const METRIC_COUNT = 5;

export default function InsightsLoading() {
  return (
    <div className={styles.page}>
      <Sidebar />

      <main className={styles.main} aria-busy="true" aria-live="polite">
        <header className={styles.header}>
          <div>
            <div className={skeleton.titleSkeleton} />
            <div className={skeleton.subtitleSkeleton} />
          </div>
          <div className={skeleton.filterSkeleton} />
        </header>

        <div className={styles.scrollContent}>
          <div className={skeleton.metricsRow}>
            {Array.from({ length: METRIC_COUNT }).map((_, index) => (
              <div className={skeleton.metricCard} key={index} />
            ))}
          </div>

          <section className={`${styles.grid} ${skeleton.chartGrid}`}>
            <div className={`${skeleton.chartCard} ${styles.spanTwo}`} />
            <div className={skeleton.chartCard} />
            <div className={skeleton.chartCard} />
            <div className={`${skeleton.chartCard} ${styles.spanTwo}`} />
            <div className={`${skeleton.chartCard} ${styles.spanThree}`} />
          </section>
        </div>
      </main>
    </div>
  );
}
