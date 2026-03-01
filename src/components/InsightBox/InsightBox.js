import styles from "./InsightBox.module.css";

export default function InsightBox({ title, value, icon, meta = null }) {
  return (
    <article className={styles.card}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <p className={styles.value}>{value}</p>
      {meta ? <div className={styles.meta}>{meta}</div> : null}
      <p className={styles.title}>{title}</p>
    </article>
  );
}
