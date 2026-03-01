import styles from "./Skeletons.module.css";

export default function MetricSkeleton() {
  return (
    <div className={styles.metricCard} aria-hidden="true">
      <div className={`${styles.metricIcon} ${styles.pulse}`} />
      <div className={`${styles.metricValue} ${styles.pulse}`} />
      <div className={`${styles.metricLabel} ${styles.pulse}`} />
    </div>
  );
}
