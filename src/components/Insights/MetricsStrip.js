import InsightBox from "@/components/InsightBox/InsightBox";
import MetricSkeleton from "@/components/Skeletons/MetricSkeleton";
import styles from "./MetricsStrip.module.css";

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function formatDelta(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
  const normalized = Number(rounded);
  if (!Number.isFinite(normalized)) {
    return null;
  }

  const sign = normalized > 0 ? "+" : "";
  return `${sign}${normalized}%`;
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="8" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 19c1.3-3 3.3-4.6 6.1-4.6S14.4 16 15.7 19M14.3 16.2c1.7.4 2.9 1.3 3.8 2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MessagesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16H11l-3.5 3V16H7a2.5 2.5 0 0 1-2.5-2.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <path
        d="M6.5 16.5l3.5-3.8 2.7 2.7 2.3-2 2.5 3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AvgIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 17.5 9 6.5h0l5 11M6.2 13h5.6M15.5 8h4.2M15.5 12h4.2M15.5 16h4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4 3.8 18h16.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v4.4M12 16.3h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function MetricsStrip({ overview, deltas = {}, loading = false }) {
  const items = [
    {
      title: "Total Users",
      value: formatNumber(overview?.totalUsers),
      icon: <UsersIcon />,
      delta: formatDelta(deltas?.totalUsers),
    },
    {
      title: "Total Messages",
      value: formatNumber(overview?.totalMessages),
      icon: <MessagesIcon />,
      delta: formatDelta(deltas?.totalMessages),
    },
    {
      title: "Images Generated",
      value: formatNumber(overview?.imagesGenerated),
      icon: <ImageIcon />,
      delta: formatDelta(deltas?.imagesGenerated),
    },
    {
      title: "Avg Msg/User",
      value: formatNumber(overview?.avgMessagesPerUser),
      icon: <AvgIcon />,
      delta: formatDelta(deltas?.avgMessagesPerUser),
    },
    {
      title: "Tool Error Rate",
      value: `${Number(overview?.toolErrorRate) || 0}%`,
      icon: <AlertIcon />,
      delta: formatDelta(deltas?.toolErrorRate),
    },
  ];

  if (loading) {
    return (
      <section className={styles.grid} aria-label="Overview metrics loading">
        {Array.from({ length: 5 }).map((_, index) => (
          <MetricSkeleton key={`metric-skeleton-${index}`} />
        ))}
      </section>
    );
  }

  return (
    <section className={styles.grid} aria-label="Overview metrics">
      {items.map((item) => (
        <InsightBox
          key={item.title}
          title={item.title}
          value={item.value}
          icon={item.icon}
          meta={
            item.delta ? (
              <div className={styles.deltaWrap}>
                <span
                  className={`${styles.deltaChip} ${item.delta.startsWith("-") ? styles.deltaNegative : styles.deltaPositive}`}
                >
                  {item.delta}
                </span>
                <span className={styles.deltaPeriod}>vs last 30d</span>
              </div>
            ) : null
          }
        />
      ))}
    </section>
  );
}
