import styles from "./Toast.module.css";

function getTypeLabel(type) {
  if (type === "success") {
    return "Success";
  }
  if (type === "error") {
    return "Error";
  }
  return "Info";
}

export default function Toast({ toasts = [], onDismiss }) {
  return (
    <div className={styles.stack} aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            styles.toast,
            toast.type === "success" ? styles.toastSuccess : "",
            toast.type === "error" ? styles.toastError : "",
            toast.type === "info" ? styles.toastInfo : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
        >
          <div className={styles.content}>
            <p className={styles.label}>{getTypeLabel(toast.type)}</p>
            <p className={styles.message}>{toast.message}</p>
          </div>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => onDismiss?.(toast.id)}
            aria-label="Dismiss notification"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
