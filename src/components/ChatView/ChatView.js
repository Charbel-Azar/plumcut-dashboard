"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import MessageBubble from "@/components/MessageBubble/MessageBubble";
import Calendar from "@/components/Calendar/Calendar";
import CalendarPopup from "@/components/Calendar/CalendarPopup";
import { parseAIMessage } from "@/utils/parseAIMessage";
import { getAvatarLabel, getUserDisplayLabel } from "@/utils/userFormatters";
import styles from "./ChatView.module.css";

const isDevelopment = process.env.NODE_ENV !== "production";

function parseDayString(dayString) {
  const [year, month, day] = dayString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDayOption(dayString) {
  const date = parseDayString(dayString);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterdayDate = new Date(today);
  yesterdayDate.setDate(today.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  if (dayString === todayStr) return "Today";
  if (dayString === yesterdayStr) return "Yesterday";

  const diffDays = Math.floor((today - date) / 86400000);
  if (diffDays < 7) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatExactDayOption(dayString) {
  const [year, month, day] = dayString.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatMonthDay(dayString) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parseDayString(dayString));
}

function formatRangeLabel(range) {
  if (!range?.start || !range?.end) {
    return "All dates";
  }

  if (range.start === range.end) {
    return formatExactDayOption(range.start);
  }

  const startDate = parseDayString(range.start);
  const endDate = parseDayString(range.end);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

  if (sameMonth) {
    const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short" }).format(startDate);
    return `${monthLabel} ${startDate.getDate()}-${endDate.getDate()}, ${startDate.getFullYear()}`;
  }

  if (sameYear) {
    return `${formatMonthDay(range.start)} - ${formatMonthDay(range.end)}, ${startDate.getFullYear()}`;
  }

  return `${formatExactDayOption(range.start)} - ${formatExactDayOption(range.end)}`;
}

function hasValidDateTime(message) {
  if (!message?.datetime || typeof message.datetime !== "string") {
    return false;
  }
  return !Number.isNaN(new Date(message.datetime).getTime());
}

function toSearchableText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getMessageSearchText(message) {
  const data = message?.data || {};
  const type = message?.type;

  if (type === "tool") {
    const toolName = data?.tool_call?.name || "";
    const toolArgs = toSearchableText(data?.tool_call?.args);
    const toolResponse = toSearchableText(data?.tool_response?.content);
    return `${toolName} ${toolArgs} ${toolResponse}`.toLowerCase();
  }

  if (type === "ai") {
    const rawContent = toSearchableText(data?.content);
    return parseAIMessage(rawContent).message.toLowerCase();
  }

  return toSearchableText(data?.content).toLowerCase();
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

function UpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 14l6-6 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 10l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 7.5A3.5 3.5 0 0 1 8 4h8a3.5 3.5 0 0 1 3.5 3.5V13A3.5 3.5 0 0 1 16 16.5h-4.5l-3.8 3v-3H8A3.5 3.5 0 0 1 4.5 13z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatMessageCount(count) {
  return `${count} message${count === 1 ? "" : "s"}`;
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

  // Prevent a future-shifted lastReadDatetime from making newer messages appear reviewed.
  return Math.min(readTimestamp, markedAtTimestamp);
}

function formatReviewTimestamp(value) {
  const timestamp = toTimestamp(value);
  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatReviewerName(name) {
  const normalized = String(name || "").trim();
  if (!normalized) {
    return "Unknown";
  }

  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1).toLowerCase()}`;
}

export default function ChatView({
  user,
  chat,
  loadingChatId,
  onBack,
  onInfoOpen,
  readReceipts = [],
  focusedDay = null,
  initialSearchQuery = "",
  focusedMessageDatetime = null,
}) {
  const chatAreaRef = useRef(null);
  const calendarBtnRef = useRef(null);
  const messageNodeRefs = useRef([]);
  const initialScrollDoneRef = useRef(false);
  const scrolledWithReceiptsRef = useRef(false);
  const pendingTargetDatetimeRef = useRef(null);
  const messages = useMemo(
    () => (chat?.messages || []).filter((message) => hasValidDateTime(message)),
    [chat?.messages]
  );

  const availableDays = useMemo(() => {
    const daySet = new Set(messages.map((message) => message.datetime.slice(0, 10)));
    return Array.from(daySet).sort((a, b) => new Date(a) - new Date(b));
  }, [messages]);

  const [selectedRange, setSelectedRange] = useState(null);
  const [chatSearchTerm, setChatSearchTerm] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeMatchPosition, setActiveMatchPosition] = useState(-1);
  const hasDateFilter = Boolean(selectedRange?.start && selectedRange?.end);
  const dayRangeLabel = availableDays.length === 0 ? "No dates" : formatRangeLabel(selectedRange);

  useEffect(() => {
    setSelectedRange(null);
    setCalendarOpen(false);
    setChatSearchTerm("");
    setActiveMatchPosition(-1);
    pendingTargetDatetimeRef.current = null;
    initialScrollDoneRef.current = false;
    scrolledWithReceiptsRef.current = false;
  }, [user?.user_id]);

  useEffect(() => {
    const day = String(focusedDay || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return;
    }

    setSelectedRange({ start: day, end: day });
    setCalendarOpen(false);
  }, [focusedDay, user?.user_id]);

  useEffect(() => {
    if (!initialSearchQuery) {
      return;
    }

    setChatSearchTerm(initialSearchQuery);
    pendingTargetDatetimeRef.current = focusedMessageDatetime || null;
  }, [initialSearchQuery, focusedMessageDatetime, user?.user_id]);

  const dateRangeMessages = useMemo(() => {
    if (!selectedRange?.start || !selectedRange?.end) {
      return messages;
    }

    return messages.filter((message) => {
      const day = message.datetime.slice(0, 10);
      return day >= selectedRange.start && day <= selectedRange.end;
    });
  }, [messages, selectedRange?.start, selectedRange?.end]);

  const maxReadTimestamp = useMemo(() => {
    const timestamps = (Array.isArray(readReceipts) ? readReceipts : [])
      .map((receipt) => getEffectiveReadTimestamp(receipt))
      .filter((timestamp) => timestamp > 0);

    if (timestamps.length === 0) {
      return 0;
    }

    return Math.max(...timestamps);
  }, [readReceipts]);

  const reviewSeparatorsByMessageIndex = useMemo(() => {
    const separators = new Map();
    if (!Array.isArray(readReceipts) || readReceipts.length === 0 || dateRangeMessages.length === 0) {
      return separators;
    }

    const timestampedMessageIndexes = dateRangeMessages
      .map((message, index) => ({
        index,
        timestamp: toTimestamp(message?.datetime),
      }))
      .filter((entry) => entry.timestamp > 0);

    readReceipts.forEach((receipt) => {
      const rawReadTimestamp = toTimestamp(receipt?.lastReadDatetime);
      const readTimestamp = getEffectiveReadTimestamp(receipt);
      if (!readTimestamp || timestampedMessageIndexes.length === 0) {
        return;
      }

      const latestTimestampedMessage =
        timestampedMessageIndexes[timestampedMessageIndexes.length - 1] || null;
      let targetMessageIndex = -1;
      for (let idx = timestampedMessageIndexes.length - 1; idx >= 0; idx -= 1) {
        if (timestampedMessageIndexes[idx].timestamp <= readTimestamp) {
          targetMessageIndex = timestampedMessageIndexes[idx].index;
          break;
        }
      }

      const maxEligibleIndex = timestampedMessageIndexes.reduce((maxIndex, entry) => {
        if (entry.timestamp <= readTimestamp) {
          return Math.max(maxIndex, entry.index);
        }
        return maxIndex;
      }, -1);

      if (targetMessageIndex > maxEligibleIndex) {
        targetMessageIndex = maxEligibleIndex;
      }

      if (isDevelopment) {
        console.log("[ChatView] receipt mapping", {
          lastReadDatetime: receipt?.lastReadDatetime,
          rawReadTimestamp,
          effectiveReadTimestamp: readTimestamp,
          markedAt: receipt?.markedAt || null,
          timestampedMessageIndexesLength: timestampedMessageIndexes.length,
          lastMessageTimestamp: latestTimestampedMessage?.timestamp || 0,
          targetMessageIndex,
        });
      }

      if (targetMessageIndex < 0) {
        return;
      }

      if (!separators.has(targetMessageIndex)) {
        separators.set(targetMessageIndex, {
          reviewedAt: readTimestamp,
          markedAt: toTimestamp(receipt?.markedAt) || readTimestamp,
          reviewerNames: new Set(),
        });
      }

      const separator = separators.get(targetMessageIndex);
      separator.reviewedAt = Math.max(separator.reviewedAt, readTimestamp);
      separator.markedAt = Math.max(
        separator.markedAt || 0,
        toTimestamp(receipt?.markedAt) || readTimestamp
      );
      separator.reviewerNames.add(formatReviewerName(receipt?.reviewerName));
    });

    return separators;
  }, [dateRangeMessages, readReceipts]);

  useEffect(() => {
    if (!isDevelopment) {
      return;
    }

    let computedMaxReadIndex = -1;
    if (reviewSeparatorsByMessageIndex.size > 0) {
      computedMaxReadIndex = Math.max(...Array.from(reviewSeparatorsByMessageIndex.keys()));
    }

    console.log("[ChatView] read index summary", {
      maxReadIndex: computedMaxReadIndex,
      totalMessages: dateRangeMessages.length,
      maxReadTimestamp,
    });
  }, [dateRangeMessages.length, maxReadTimestamp, reviewSeparatorsByMessageIndex]);

  const matchingMessageIndexes = useMemo(() => {
    const query = chatSearchTerm.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return dateRangeMessages.reduce((indexes, message, index) => {
      if (getMessageSearchText(message).includes(query)) {
        indexes.push(index);
      }
      return indexes;
    }, []);
  }, [dateRangeMessages, chatSearchTerm]);
  const matchingIndexSet = useMemo(() => new Set(matchingMessageIndexes), [matchingMessageIndexes]);

  const activeMessageIndex =
    activeMatchPosition >= 0 ? matchingMessageIndexes[activeMatchPosition] ?? -1 : -1;

  const scrollMessageNode = (targetNode, align = "center", behavior = "auto") => {
    const container = chatAreaRef.current;
    if (!container || !targetNode) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const nodeRect = targetNode.getBoundingClientRect();
    const nodeTopWithinContainer = nodeRect.top - containerRect.top + container.scrollTop;

    const targetTop =
      align === "start"
        ? nodeTopWithinContainer
        : nodeTopWithinContainer - container.clientHeight / 2 + nodeRect.height / 2;

    const nextTop = Math.max(0, targetTop);
    try {
      container.scrollTo({
        top: nextTop,
        behavior,
      });
    } catch {
      container.scrollTop = nextTop;
    }
  };

  useEffect(() => {
    if (!chatSearchTerm.trim() || matchingMessageIndexes.length === 0) {
      setActiveMatchPosition(-1);
      return;
    }

    setActiveMatchPosition((current) => {
      if (current >= 0 && current < matchingMessageIndexes.length) {
        return current;
      }
      return 0;
    });
  }, [chatSearchTerm, matchingMessageIndexes.length]);

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [selectedRange?.start, selectedRange?.end]);

  useEffect(() => {
    if (!user?.user_id || !chatAreaRef.current) {
      return;
    }
    if (!initialScrollDoneRef.current) {
      return;
    }
    chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
  }, [user?.user_id, dateRangeMessages.length]);

  useEffect(() => {
    if (!user?.user_id || !chatAreaRef.current || dateRangeMessages.length === 0) {
      return;
    }

    if (maxReadTimestamp > 0 && !scrolledWithReceiptsRef.current) {
      scrolledWithReceiptsRef.current = true;
      initialScrollDoneRef.current = true;

      const firstUnreadIndex = dateRangeMessages.findIndex(
        (message) => toTimestamp(message.datetime) > maxReadTimestamp
      );

      if (firstUnreadIndex >= 0) {
        const targetNode = messageNodeRefs.current[firstUnreadIndex];
        if (targetNode) {
          scrollMessageNode(targetNode, "start", "auto");
          return;
        }
      }

      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
      return;
    }

    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [user?.user_id, dateRangeMessages, maxReadTimestamp]);

  useEffect(() => {
    if (!pendingTargetDatetimeRef.current || matchingMessageIndexes.length === 0) {
      return;
    }

    const targetDatetime = pendingTargetDatetimeRef.current;
    const targetMessageIndex = dateRangeMessages.findIndex(
      (message) => message.datetime === targetDatetime
    );

    if (targetMessageIndex >= 0) {
      const matchPosition = matchingMessageIndexes.indexOf(targetMessageIndex);
      if (matchPosition >= 0) {
        pendingTargetDatetimeRef.current = null;
        setActiveMatchPosition(matchPosition);
        return;
      }
    }

    pendingTargetDatetimeRef.current = null;
    setActiveMatchPosition(0);
  }, [matchingMessageIndexes, dateRangeMessages]);

  useEffect(() => {
    if (activeMessageIndex < 0) {
      return;
    }

    const targetNode = messageNodeRefs.current[activeMessageIndex];
    if (!targetNode) {
      return;
    }

    scrollMessageNode(targetNode, "center", "smooth");
  }, [activeMessageIndex]);

  function jumpToMatch(direction) {
    if (matchingMessageIndexes.length === 0) {
      return;
    }

    setActiveMatchPosition((current) => {
      if (direction === "next") {
        return current < 0 ? 0 : (current + 1) % matchingMessageIndexes.length;
      }

      if (current < 0) {
        return matchingMessageIndexes.length - 1;
      }
      return (current - 1 + matchingMessageIndexes.length) % matchingMessageIndexes.length;
    });
  }

  if (!user) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyBrand}>plumcut</div>
        <ChatIcon />
        <p>Select a conversation to start reviewing</p>
        <p className={styles.emptyHint}>Use the search or browse the list on the left</p>
      </div>
    );
  }

  if (!chat && loadingChatId === user?.user_id) {
    return (
      <div className={styles.emptyState}>
        <ChatIcon />
        <p>Loading chat...</p>
      </div>
    );
  }

  messageNodeRefs.current = [];

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.identity}>
          {onBack && (
            <button
              type="button"
              className={`${styles.iconButton} ${styles.mobileControl}`}
              onClick={onBack}
              aria-label="Back to user list"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M15 6l-6 6 6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          <span className={styles.avatar}>{getAvatarLabel(user.user_id, user.username)}</span>
          <div className={styles.identityMeta}>
            <h2 className={styles.phone}>{getUserDisplayLabel(user)}</h2>
            <p className={styles.messageCountLabel}>{formatMessageCount(dateRangeMessages.length)}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <div className={styles.chatSearchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={chatSearchTerm}
              onChange={(event) => setChatSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  jumpToMatch(event.shiftKey ? "prev" : "next");
                }
              }}
              className={styles.chatSearchInput}
              placeholder="Search chat..."
              aria-label="Search chat messages"
            />
            {chatSearchTerm && (
              <button
                type="button"
                className={styles.chatSearchClear}
                onClick={() => setChatSearchTerm("")}
                aria-label="Clear chat search"
              >
                <ClearIcon className={styles.clearIcon} />
              </button>
            )}
          </div>
          {chatSearchTerm.trim() && (
            <div className={styles.chatSearchNav} aria-label="Search navigation controls">
              <button
                type="button"
                className={styles.navButton}
                onClick={() => jumpToMatch("prev")}
                disabled={matchingMessageIndexes.length === 0}
                aria-label="Previous matching message"
              >
                <UpIcon />
              </button>
              <button
                type="button"
                className={styles.navButton}
                onClick={() => jumpToMatch("next")}
                disabled={matchingMessageIndexes.length === 0}
                aria-label="Next matching message"
              >
                <DownIcon />
              </button>
              <span className={styles.matchCount}>
                {matchingMessageIndexes.length === 0
                  ? "0"
                  : `${activeMatchPosition + 1}/${matchingMessageIndexes.length}`}
              </span>
            </div>
          )}

          <div className={styles.dayPickerWrap}>
            <button
              type="button"
              ref={calendarBtnRef}
              className={`${styles.dayButton} ${hasDateFilter ? styles.dayButtonActive : ""}`}
              onClick={() => setCalendarOpen((open) => !open)}
              aria-label="Select chat date range"
              aria-expanded={calendarOpen}
              disabled={availableDays.length === 0}
              title={dayRangeLabel}
            >
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
              <span>{dayRangeLabel}</span>
            </button>

            <CalendarPopup
              isOpen={calendarOpen}
              onClose={() => setCalendarOpen(false)}
              anchorRef={calendarBtnRef}
            >
              <Calendar
                mode="range"
                selectedRange={selectedRange}
                highlightedDates={availableDays}
                initialMonth={selectedRange?.start || availableDays[availableDays.length - 1] || null}
                onSelect={(range) => {
                  setSelectedRange(range);
                  setCalendarOpen(false);
                }}
              />
            </CalendarPopup>
          </div>

          {onInfoOpen && (
            <button
              type="button"
              className={`${styles.iconButton} ${styles.mobileControl}`}
              onClick={onInfoOpen}
              aria-label="Open user info"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="8" r="1.2" fill="currentColor" />
                <path
                  d="M12 11v5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </header>

      <div ref={chatAreaRef} className={styles.chatArea}>
        {dateRangeMessages.map((message, index) => {
          const day = message.datetime.slice(0, 10);
          const previousDay =
            index > 0 ? dateRangeMessages[index - 1].datetime.slice(0, 10) : null;
          const showDaySeparator = day !== previousDay;
          const query = chatSearchTerm.trim();
          const isMatch = !!query && matchingIndexSet.has(index);
          const isActive = index === activeMessageIndex;
          const isReadMessage =
            maxReadTimestamp > 0 && toTimestamp(message.datetime) <= maxReadTimestamp;
          const reviewSeparator = reviewSeparatorsByMessageIndex.get(index);
          const messageKey = `${message.type}-${message.datetime}-${message.execution_id || "na"}-${index}`;

          return (
            <Fragment key={messageKey}>
              {showDaySeparator && (
                <div className={styles.dateSeparator}>
                  <span>{formatDayOption(day)}</span>
                </div>
              )}
              <div
                ref={(node) => {
                  messageNodeRefs.current[index] = node;
                }}
                className={[
                  styles.messageItem,
                  isReadMessage ? styles.messageRead : "",
                  isMatch ? styles.messageMatch : "",
                  isActive ? styles.messageActiveMatch : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MessageBubble message={message} />
              </div>
              {reviewSeparator && (
                <div className={styles.reviewSeparator}>
                  <span>
                    {`Reviewed up to here by ${Array.from(reviewSeparator.reviewerNames)
                      .sort()
                      .join(", ")} - ${formatReviewTimestamp(reviewSeparator.markedAt || reviewSeparator.reviewedAt)}`}
                  </span>
                </div>
              )}
            </Fragment>
          );
        })}

        {dateRangeMessages.length === 0 && (
          <div className={styles.emptyState}>
            <ChatIcon />
            <p>No messages for the selected filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
