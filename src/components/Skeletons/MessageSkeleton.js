import styles from "./Skeletons.module.css";

const SKELETON_ROWS = [
  "left",
  "right",
  "left",
  "right",
  "left",
  "right",
  "left",
];

export default function MessageSkeleton() {
  return (
    <div className={styles.messageWrap} aria-hidden="true">
      {SKELETON_ROWS.map((side, index) => (
        <div
          key={`${side}-${index}`}
          className={[
            styles.messageBubble,
            styles.pulse,
            side === "right" ? styles.messageBubbleRight : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
    </div>
  );
}
