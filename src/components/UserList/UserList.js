"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Calendar from "@/components/Calendar/Calendar";
import CalendarPopup from "@/components/Calendar/CalendarPopup";
import UserCardSkeleton from "@/components/Skeletons/UserCardSkeleton";
import { parseAIMessage } from "@/utils/parseAIMessage";
import { formatPhoneNumber, getAvatarLabel, getUserDisplayLabel } from "@/utils/userFormatters";
import styles from "./UserList.module.css";

const PAGE_SIZE = 10;

function formatDayLabel(isoDate) {
  if (!isoDate) {
    return "-";
  }

  const date =
    isoDate.includes("T") || isoDate.includes(" ")
      ? new Date(isoDate)
      : (() => {
          const [year, month, day] = isoDate.split("-").map(Number);
          return new Date(year, month - 1, day);
        })();

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatRangeLabel(range) {
  if (!range?.start || !range?.end) {
    return "All dates";
  }

  if (range.start === range.end) {
    return formatDayLabel(range.start);
  }

  return `${formatDayLabel(range.start)} - ${formatDayLabel(range.end)}`;
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getLatestReceiptForUser(receipts) {
  if (!Array.isArray(receipts) || receipts.length === 0) {
    return null;
  }

  return receipts
    .filter((receipt) => {
      const chatUserId = String(receipt?.chatUserId || "").trim();
      const reviewerName = String(receipt?.reviewerName || "").trim().toLowerCase();
      return Boolean(chatUserId && reviewerName);
    })
    .sort((a, b) => {
      const aRead = toTimestamp(a?.lastReadDatetime) || toTimestamp(a?.markedAt);
      const bRead = toTimestamp(b?.lastReadDatetime) || toTimestamp(b?.markedAt);
      return bRead - aRead;
    })[0];
}

function isUserFullyReviewed(user, allReadReceipts) {
  const receiptsForUser = allReadReceipts?.[user?.user_id] || [];
  const latestReceipt = getLatestReceiptForUser(receiptsForUser);
  const latestReadTimestamp = toTimestamp(latestReceipt?.lastReadDatetime);
  const latestMessageTimestamp = toTimestamp(user?.latest_message?.datetime);

  return (
    latestReadTimestamp > 0 &&
    latestMessageTimestamp > 0 &&
    latestReadTimestamp >= latestMessageTimestamp
  );
}

function getMessagePreview(message) {
  if (!message) {
    return "No messages yet.";
  }

  const rawType = typeof message.type === "string" ? message.type : "";
  const isToolMessage = rawType === "tool";

  if (message.type === "tool") {
    const toolName = message.data?.tool_call?.name || message.data?.tool_response?.name || "tool";
    const response = message.data?.tool_response?.content || message.content || "";
    const prefix = message.data?.is_error ? `Tool error (${toolName})` : `Tool (${toolName})`;
    const preview = response.replace(/\s+/g, " ").trim();

    if (!preview) {
      return prefix;
    }

    const clipped = preview.length > 45 ? `${preview.slice(0, 45).trimEnd()}...` : preview;
    return `${prefix}: ${clipped}`;
  }

  const raw = message.data?.content || message.content || "";
  const baseMessage = !isToolMessage && rawType === "ai" ? parseAIMessage(raw).message : raw;
  const normalized = baseMessage.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "No text content.";
  }

  return normalized.length > 45 ? `${normalized.slice(0, 45).trimEnd()}...` : normalized;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16 16l5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClearIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M6 6l12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="15"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 3.5v4M16 3.5v4M3.5 10.5h17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="10.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.5 18a4.5 4.5 0 0 1 9 0M13 18a3.5 3.5 0 0 1 7 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function UserList({
  users,
  selectedUserId,
  onSelectUser,
  initialDateRange = null,
  allReadReceipts = {},
  isLoading = false,
  onListStatsChange,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateRange, setDateRange] = useState(initialDateRange);
  const [page, setPage] = useState(1);
  const [reviewFilter, setReviewFilter] = useState("all");
  const calendarBtnRef = useRef(null);
  const listRef = useRef(null);
  const sentinelRef = useRef(null);
  const paginationLockRef = useRef(false);
  const hasDateFilter = Boolean(dateRange?.start && dateRange?.end);
  const hasSearchTerm = searchTerm.trim().length > 0;

  useEffect(() => {
    setPage(1);
  }, [searchTerm, dateRange?.start, dateRange?.end, reviewFilter]);

  useEffect(() => {
    if (!initialDateRange?.start || !initialDateRange?.end) {
      return;
    }
    setDateRange(initialDateRange);
  }, [initialDateRange?.start, initialDateRange?.end]);

  const allMessageDates = useMemo(() => {
    const daySet = new Set();

    users.forEach((user) => {
      const day = user.latest_message?.datetime?.slice(0, 10);
      if (day) {
        daySet.add(day);
      }
    });

    return Array.from(daySet).sort((a, b) => new Date(b) - new Date(a));
  }, [users]);

  const sortedUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const filteredUsers = users.filter((user) => {
      const username = (user.username || "").toLowerCase();
      const rawPhone = user.user_id.replace("whatsapp:", "").toLowerCase();
      const formattedPhone = formatPhoneNumber(user.user_id).toLowerCase();
      const hasMatchingUser =
        !query ||
        username.includes(query) ||
        rawPhone.includes(query) ||
        formattedPhone.includes(query);

      if (!hasMatchingUser) {
        return false;
      }

      if (dateRange?.start && dateRange?.end) {
        const day = user.latest_message?.datetime?.slice(0, 10);
        if (!day || day < dateRange.start || day > dateRange.end) {
          return false;
        }
      }

      if (reviewFilter !== "all") {
        const isFullyReviewed = isUserFullyReviewed(user, allReadReceipts);
        if (reviewFilter === "reviewed" && !isFullyReviewed) return false;
        if (reviewFilter === "unreviewed" && isFullyReviewed) return false;
      }

      return true;
    });

    if (!query && !dateRange?.start && !dateRange?.end && reviewFilter === "all") {
      return filteredUsers;
    }

    return filteredUsers
      .map((user) => ({
        user,
        time: user.latest_message?.datetime ? new Date(user.latest_message.datetime).getTime() : 0,
      }))
      .sort((a, b) => b.time - a.time)
      .map((entry) => entry.user);
  }, [users, searchTerm, dateRange?.start, dateRange?.end, reviewFilter, allReadReceipts]);

  const visibleUsers = useMemo(
    () => sortedUsers.slice(0, page * PAGE_SIZE),
    [sortedUsers, page]
  );

  const reviewCounts = useMemo(() => {
    const reviewed = users.reduce((count, user) => {
      return count + (isUserFullyReviewed(user, allReadReceipts) ? 1 : 0);
    }, 0);
    const all = users.length;
    return {
      all,
      reviewed,
      unreviewed: Math.max(0, all - reviewed),
    };
  }, [allReadReceipts, users]);

  const hasMore = visibleUsers.length < sortedUsers.length;
  const showInitialSkeletons =
    isLoading && users.length === 0 && !hasSearchTerm && !hasDateFilter && reviewFilter === "all";

  const isFiltered = hasSearchTerm || hasDateFilter || reviewFilter !== "all";

  useEffect(() => {
    if (typeof onListStatsChange !== "function") {
      return;
    }

    onListStatsChange({
      filteredCount: sortedUsers.length,
      totalCount: users.length,
      isFiltered,
    });
  }, [isFiltered, onListStatsChange, sortedUsers.length, users.length]);

  useEffect(() => {
    paginationLockRef.current = false;
  }, [visibleUsers.length, hasMore]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || showInitialSkeletons || isLoading) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || paginationLockRef.current) {
          return;
        }
        paginationLockRef.current = true;
        setPage((current) => current + 1);
      },
      {
        root: listRef.current,
        rootMargin: "200px",
      }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, showInitialSkeletons, visibleUsers.length]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.searchWrap}>
        <div className={styles.searchRow}>
          <div className={styles.searchInputWrap}>
            <span className={styles.searchIcon} aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search by phone or name..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={styles.searchInput}
            />
            {searchTerm && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
              >
                <ClearIcon className={styles.clearIcon} />
              </button>
            )}
          </div>

          <div className={styles.calendarWrap}>
            <button
              type="button"
              ref={calendarBtnRef}
              className={`${styles.calendarButton} ${hasDateFilter ? styles.calendarButtonActive : ""}`}
              onClick={() => setCalendarOpen((open) => !open)}
              aria-label="Filter users by date range"
              aria-expanded={calendarOpen}
            >
              <CalendarIcon />
              {hasDateFilter && (
                <span className={styles.calendarLabel} suppressHydrationWarning>
                  {formatRangeLabel(dateRange)}
                </span>
              )}
            </button>

            <CalendarPopup
              isOpen={calendarOpen}
              onClose={() => setCalendarOpen(false)}
              anchorRef={calendarBtnRef}
            >
              <Calendar
                mode="range"
                selectedRange={dateRange}
                highlightedDates={allMessageDates}
                initialMonth={dateRange?.start || allMessageDates[0] || null}
                onSelect={(range) => {
                  setDateRange(range);
                  setCalendarOpen(false);
                }}
              />
            </CalendarPopup>
          </div>
        </div>

        <div className={styles.filterRow}>
          <button
            type="button"
            className={`${styles.filterBtn} ${reviewFilter === "all" ? styles.filterBtnActive : ""}`}
            onClick={() => setReviewFilter("all")}
          >
            <span>All</span>
            <span className={styles.filterCount}>({reviewCounts.all})</span>
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${reviewFilter === "reviewed" ? styles.filterBtnActiveReviewed : ""}`}
            onClick={() => setReviewFilter("reviewed")}
          >
            <span>Reviewed</span>
            <span className={styles.filterCount}>({reviewCounts.reviewed})</span>
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${reviewFilter === "unreviewed" ? styles.filterBtnActiveUnreviewed : ""}`}
            onClick={() => setReviewFilter("unreviewed")}
          >
            <span>Not Reviewed</span>
            <span className={styles.filterCount}>({reviewCounts.unreviewed})</span>
          </button>
        </div>

        {dateRange?.start && dateRange?.end && (
          <div className={styles.dateChip}>
            <span suppressHydrationWarning>{`${formatDayLabel(dateRange.start)} - ${formatDayLabel(dateRange.end)}`}</span>
            <button
              type="button"
              onClick={() => setDateRange(null)}
              className={styles.dateChipClear}
              aria-label="Clear date range filter"
            >
              <ClearIcon className={styles.clearIcon} />
            </button>
          </div>
        )}
      </div>

      <div ref={listRef} className={styles.list}>
        {showInitialSkeletons &&
          Array.from({ length: 8 }).map((_, index) => <UserCardSkeleton key={`user-skeleton-${index}`} />)}

        {visibleUsers.map((user) => {
          const latestMessage = user.latest_message || null;
          const isSelected = selectedUserId === user.user_id;
          const receiptsForUser = allReadReceipts?.[user.user_id] || [];
          const latestReceipt = getLatestReceiptForUser(receiptsForUser);
          const latestReadTimestamp = toTimestamp(latestReceipt?.lastReadDatetime);
          const latestMessageTimestamp = toTimestamp(latestMessage?.datetime);
          const showReadDot =
            latestReadTimestamp > 0 &&
            latestMessageTimestamp > 0 &&
            latestReadTimestamp >= latestMessageTimestamp;

          return (
            <button
              key={user._id}
              type="button"
              className={`${styles.item} ${isSelected ? styles.selected : ""}`}
              onClick={() => onSelectUser(user.user_id)}
            >
              <div className={styles.avatarWrap}>
                <span className={`${styles.avatar} ${showReadDot ? styles.avatarReviewed : ""}`}>
                  {getAvatarLabel(user.user_id, user.username)}
                </span>
              </div>

              <div className={styles.itemBody}>
                <div className={styles.topRow}>
                  <p className={styles.phone}>{getUserDisplayLabel(user)}</p>
                  <p className={styles.date} suppressHydrationWarning>
                    {formatDayLabel(latestMessage?.datetime)}
                  </p>
                </div>
                <p className={styles.preview}>{getMessagePreview(latestMessage)}</p>
              </div>
            </button>
          );
        })}

        {hasMore && !showInitialSkeletons && (
          <>
            <div ref={sentinelRef} className={styles.loadMoreSentinel} aria-hidden="true" />
            <button
              type="button"
              className={styles.loadMoreButton}
              onClick={() => setPage((current) => current + 1)}
            >
              Load more ({sortedUsers.length - visibleUsers.length} remaining)
            </button>
          </>
        )}

        {!showInitialSkeletons && sortedUsers.length === 0 && (
          <div className={styles.emptyState}>
            <UsersIcon />
            <p>No users found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
