import styles from "./Skeletons.module.css";

export default function UserCardSkeleton() {
  return (
    <div className={styles.userCard} aria-hidden="true">
      <div className={`${styles.userAvatar} ${styles.pulse}`} />
      <div className={styles.userBody}>
        <div className={`${styles.userLine} ${styles.pulse}`} />
        <div className={`${styles.userLine} ${styles.userLineShort} ${styles.pulse}`} />
      </div>
    </div>
  );
}
