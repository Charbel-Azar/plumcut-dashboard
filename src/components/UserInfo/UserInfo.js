"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPhoneNumber, getAvatarLabel } from "@/utils/userFormatters";
import styles from "./UserInfo.module.css";

function formatDateTime(isoDate) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

function formatReviewedAt(isoDate) {
  if (!isoDate) {
    return "-";
  }

  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) {
    return isoDate;
  }

  const date = new Date(timestamp);
  const monthDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `${monthDay} at ${time}`;
}

function formatReviewerName(reviewerName) {
  const normalized = String(reviewerName || "").trim();
  if (!normalized) {
    return "Unknown";
  }
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1).toLowerCase()}`;
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getEffectiveReadTimestamp(receipt) {
  const readTimestamp = toTimestamp(receipt?.lastReadDatetime);
  if (!readTimestamp) {
    return 0;
  }

  const markedAtTimestamp = toTimestamp(receipt?.markedAt);
  if (!markedAtTimestamp) {
    return readTimestamp;
  }

  return Math.min(readTimestamp, markedAtTimestamp);
}

function isUpToDateReceipt(receipt, latestMessageDatetime) {
  const latestMessageTimestamp = toTimestamp(latestMessageDatetime);
  if (!latestMessageTimestamp) {
    return true;
  }

  const readTimestamp = getEffectiveReadTimestamp(receipt);
  return readTimestamp > 0 && readTimestamp >= latestMessageTimestamp;
}

function getToolName(message) {
  return String(
    message?.data?.tool_call?.name ||
      message?.data?.tool_response?.name ||
      message?.name ||
      ""
  )
    .trim()
    .toLowerCase();
}

function formatConversationStart(isoDate) {
  const timestamp = toTimestamp(isoDate);
  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export default function UserInfo({
  user,
  chat,
  onClose,
  readReceipts = [],
  currentReviewer = null,
  latestMessageDatetime = null,
  onMarkAsRead,
}) {
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [isMarkedDone, setIsMarkedDone] = useState(false);

  const sortedReadReceipts = useMemo(
    () =>
      (Array.isArray(readReceipts) ? readReceipts : [])
        .slice()
        .sort((a, b) => {
          const aTime = toTimestamp(a?.markedAt) || toTimestamp(a?.lastReadDatetime);
          const bTime = toTimestamp(b?.markedAt) || toTimestamp(b?.lastReadDatetime);
          return bTime - aTime;
        }),
    [readReceipts]
  );

  const normalizedCurrentReviewer = String(currentReviewer || "")
    .trim()
    .toLowerCase();
  const currentReviewerReceipt = sortedReadReceipts.find(
    (receipt) =>
      String(receipt?.reviewerName || "")
        .trim()
        .toLowerCase() === normalizedCurrentReviewer
  );
  const alreadyReviewedByCurrentUser = currentReviewerReceipt
    ? isUpToDateReceipt(currentReviewerReceipt, latestMessageDatetime)
    : false;

  const conversationStats = useMemo(() => {
    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
    if (messages.length === 0) {
      return {
        totalMessages: 0,
        startedAt: null,
        imagesGenerated: 0,
      };
    }

    let earliestTimestamp = 0;
    let imagesGenerated = 0;

    messages.forEach((message) => {
      const type = String(message?.type || "")
        .trim()
        .toLowerCase();
      if (type === "tool" && ["image_generator", "generate_image"].includes(getToolName(message))) {
        imagesGenerated += 1;
      }

      const timestamp = toTimestamp(message?.datetime);
      if (timestamp > 0 && (earliestTimestamp === 0 || timestamp < earliestTimestamp)) {
        earliestTimestamp = timestamp;
      }
    });

    return {
      totalMessages: messages.length,
      startedAt: earliestTimestamp > 0 ? new Date(earliestTimestamp).toISOString() : null,
      imagesGenerated,
    };
  }, [chat?.messages]);

  useEffect(() => {
    setIsMarkingRead(false);
    setIsMarkedDone(false);
  }, [user?.user_id]);

  useEffect(() => {
    if (!isMarkedDone) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setIsMarkedDone(false);
    }, 1400);

    return () => window.clearTimeout(timeoutId);
  }, [isMarkedDone]);

  if (!user) {
    return (
      <div className={styles.empty}>
        <svg className={styles.emptyIcon} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M4 20c1.9-3.8 5-5.8 8-5.8s6.1 2 8 5.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <p className={styles.emptyText}>Select a conversation to view user details and session metadata.</p>
      </div>
    );
  }

  const avatarLabel = getAvatarLabel(user.user_id, user.username);
  const markDisabled =
    !currentReviewer ||
    !latestMessageDatetime ||
    isMarkingRead ||
    alreadyReviewedByCurrentUser ||
    typeof onMarkAsRead !== "function";

  const handleMarkAsReadClick = async () => {
    if (markDisabled) {
      return;
    }

    setIsMarkingRead(true);
    try {
      const success = await onMarkAsRead(user.user_id, latestMessageDatetime);
      if (success) {
        setIsMarkedDone(true);
      }
    } finally {
      setIsMarkingRead(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h2 className={styles.title}>User Info</h2>
        {onClose && (
          <button
            type="button"
            className={`${styles.closeButton} ${styles.mobileControl}`}
            onClick={onClose}
            aria-label="Close user info"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </header>

      <div className={styles.avatarHeader}>
        <span className={styles.avatar}>{avatarLabel}</span>
        <p className={styles.phone}>{formatPhoneNumber(user.user_id)}</p>
      </div>

      <section className={styles.statsStrip} aria-label="Conversation stats">
        <div className={`${styles.statCard} ${styles.statCardWide}`}>
          <p className={styles.statValue}>{formatConversationStart(conversationStats.startedAt)}</p>
          <p className={styles.statLabel}>Conversation Start</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{conversationStats.totalMessages}</p>
          <p className={styles.statLabel}>Total Messages</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{conversationStats.imagesGenerated}</p>
          <p className={styles.statLabel}>Images Generated</p>
        </div>
      </section>

      <div className={styles.group}>
        <p className={styles.label}>Active Image URL</p>
        {user.active_image_url ? (
          <>
            <a className={styles.value} href={user.active_image_url} target="_blank" rel="noreferrer">
              {user.active_image_url}
            </a>
            <img
              src={user.active_image_url}
              alt="Active image preview"
              className={styles.imageThumb}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </>
        ) : (
          <p className={styles.value}>-</p>
        )}
      </div>

      <div className={styles.group}>
        <p className={styles.label}>Image Activated At</p>
        <p className={styles.value}>
          {user.image_activated_at ? formatDateTime(user.image_activated_at) : "-"}
        </p>
      </div>

      <div className={styles.reviewedSection}>
        <button
          type="button"
          className={`${styles.markReadBtn} ${(alreadyReviewedByCurrentUser || isMarkedDone) ? styles.markReadBtnDone : ""}`}
          onClick={handleMarkAsReadClick}
          disabled={markDisabled}
        >
          {isMarkingRead ? (
            <span className={styles.markReadBtnLoading}>
              <span className={styles.markReadSpinner} aria-hidden="true" />
              <span>Marking...</span>
            </span>
          ) : alreadyReviewedByCurrentUser ? (
            "Already Reviewed ✓"
          ) : isMarkedDone ? (
            "Marked!"
          ) : (
            "Mark as Read"
          )}
        </button>

        <p className={styles.label}>Reviewed By</p>
        {sortedReadReceipts.length === 0 && (
          <p className={styles.value}>Not yet reviewed by anyone</p>
        )}

        {sortedReadReceipts.length > 0 && (
          <div className={styles.reviewList}>
            {sortedReadReceipts.map((receipt) => {
              const fresh = isUpToDateReceipt(receipt, latestMessageDatetime);
              const reviewedAtLabel = formatReviewedAt(receipt.markedAt || receipt.lastReadDatetime);
              const reviewerName = formatReviewerName(receipt.reviewerName);

              return (
                <p
                  key={`${receipt.chatUserId}-${receipt.reviewerName}-${receipt.markedAt || receipt.lastReadDatetime}`}
                  className={`${styles.reviewEntry} ${fresh ? "" : styles.reviewEntryStale}`}
                >
                  {fresh
                    ? `Reviewed by ${reviewerName} · ${reviewedAtLabel}`
                    : `⚠ ${reviewerName} reviewed (${reviewedAtLabel}) — new messages since`}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
