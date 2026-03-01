"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar/Sidebar";
import Calendar from "@/components/Calendar/Calendar";
import CalendarPopup from "@/components/Calendar/CalendarPopup";
import MetricsStrip from "@/components/Insights/MetricsStrip";
import MessageTrendChart from "@/components/Insights/MessageTrendChart";
import MessageTypeChart from "@/components/Insights/MessageTypeChart";
import ToolUsageChart from "@/components/Insights/ToolUsageChart";
import TopUsersTable from "@/components/Insights/TopUsersTable";
import ActivityByHourChart from "@/components/Insights/ActivityByHourChart";
import { useRefresh } from "@/context/RefreshContext";
import styles from "./insights.module.css";

function formatDayLabel(isoDate) {
  if (!isoDate) {
    return "";
  }

  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function normalizeDateRange(range) {
  if (!range?.start && !range?.end) {
    return null;
  }

  if (range?.start && !range?.end) {
    return { start: range.start, end: range.start };
  }

  if (!range?.start || !range?.end) {
    return null;
  }

  if (range.start <= range.end) {
    return range;
  }

  return { start: range.end, end: range.start };
}

function shiftIsoDay(isoDay, offsetDays) {
  if (!isoDay || typeof isoDay !== "string") {
    return null;
  }

  const date = new Date(`${isoDay}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setDate(date.getDate() + Number(offsetDays || 0));
  return date.toISOString().slice(0, 10);
}

function getRangeLengthInDays(range) {
  if (!range?.start || !range?.end) {
    return 0;
  }

  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) {
    return 0;
  }

  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

function computeDateHourBuckets(chats) {
  const buckets = {};

  (Array.isArray(chats) ? chats : []).forEach((chat) => {
    const messages = Array.isArray(chat?.messages) ? chat.messages : [];

    messages.forEach((message) => {
      const datetime = typeof message?.datetime === "string" ? message.datetime : "";
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}/.test(datetime)) {
        return;
      }

      const date = datetime.slice(0, 10);
      const hour = Number.parseInt(datetime.slice(11, 13), 10);
      if (!date || Number.isNaN(hour) || hour < 0 || hour > 23) {
        return;
      }

      const key = `${date}|${hour}`;
      if (!buckets[key]) {
        buckets[key] = { date, hour, count: 0 };
      }
      buckets[key].count += 1;
    });
  });

  return Object.values(buckets).sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return a.hour - b.hour;
  });
}

function getMessageDay(message) {
  const datetime = typeof message?.datetime === "string" ? message.datetime : "";
  const day = datetime.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function isMessageInRange(message, dateRange) {
  const day = getMessageDay(message);
  if (!day || !dateRange?.start || !dateRange?.end) {
    return false;
  }
  return day >= dateRange.start && day <= dateRange.end;
}

function getMessageRole(message) {
  return typeof message?.role === "string" ? message.role.trim().toLowerCase() : "";
}

function getMessageType(message) {
  if (typeof message?.type === "string") {
    return message.type.trim().toLowerCase();
  }

  if (typeof message?.kwargs?.type === "string") {
    return message.kwargs.type.trim().toLowerCase();
  }

  return "";
}

function isToolMessage(message) {
  const role = getMessageRole(message);
  const type = getMessageType(message);
  return role === "tool" || type === "tool" || type.includes("tool_result");
}

function getToolNameFromAssistantMessage(message) {
  const toolCallsCandidates = [
    message?.tool_calls,
    message?.data?.tool_calls,
    message?.additional_kwargs?.tool_calls,
    message?.data?.additional_kwargs?.tool_calls,
  ];

  const toolCall =
    toolCallsCandidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0)?.[0] ||
    null;
  const callName = typeof toolCall?.name === "string" ? toolCall.name.trim() : "";
  if (callName) {
    return callName;
  }

  const contentCandidates = [message?.content, message?.data?.content];
  for (const content of contentCandidates) {
    if (Array.isArray(content)) {
      const toolUseBlock = content.find(
        (block) =>
          typeof block?.type === "string" &&
          block.type.toLowerCase().includes("tool_use") &&
          typeof block?.name === "string" &&
          block.name.trim()
      );
      if (toolUseBlock?.name) {
        return toolUseBlock.name.trim();
      }
    }

    if (typeof content === "string" && content.trim()) {
      const match = content.match(/\bTool:\s*([A-Za-z0-9_.:-]+)/i);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
  }

  return "";
}

function resolveToolName(message, messages, index) {
  const directCandidates = [
    message?.data?.tool_call?.name,
    message?.name,
    message?.data?.name,
    message?.data?.tool_response?.name,
  ];

  const directName = directCandidates.find(
    (candidate) => typeof candidate === "string" && candidate.trim()
  );
  if (directName) {
    return directName.trim();
  }

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const previous = messages[cursor];
    if (!previous) {
      continue;
    }

    const previousRole = getMessageRole(previous);
    const previousType = getMessageType(previous);
    if (previousRole !== "assistant" && previousType !== "ai") {
      continue;
    }

    const fromAssistant = getToolNameFromAssistantMessage(previous);
    if (fromAssistant) {
      return fromAssistant;
    }
    break;
  }

  return "tool";
}

function isToolErrorMessage(message) {
  return Boolean(
    message?.data?.is_error ||
      message?.data?.isError ||
      message?.is_error ||
      message?.isError ||
      message?.data?.tool_response?.is_error ||
      message?.data?.tool_response?.isError
  );
}

function isImageGenerationToolName(toolName) {
  const normalized = String(toolName || "").trim().toLowerCase();
  return normalized === "image_generator" || normalized === "generate_image";
}

function computeOverviewForRange(chats, dateRange) {
  const scopedChats = Array.isArray(chats) ? chats : [];
  if (!dateRange?.start || !dateRange?.end) {
    return {
      totalUsers: 0,
      totalMessages: 0,
      imagesGenerated: 0,
      avgMessagesPerUser: 0,
      toolErrorRate: 0,
    };
  }

  const activeUsers = new Set();
  let totalMessages = 0;
  let imagesGenerated = 0;
  let toolCalls = 0;
  let toolErrors = 0;

  scopedChats.forEach((chat) => {
    const sessionId = String(chat?.sessionId || "").trim();
    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
    let hasMessagesInRange = false;

    messages.forEach((message, index) => {
      if (!isMessageInRange(message, dateRange)) {
        return;
      }

      hasMessagesInRange = true;
      totalMessages += 1;

      if (!isToolMessage(message)) {
        return;
      }

      toolCalls += 1;
      if (isToolErrorMessage(message)) {
        toolErrors += 1;
      }

      const toolName = resolveToolName(message, messages, index);
      if (isImageGenerationToolName(toolName)) {
        imagesGenerated += 1;
      }
    });

    if (hasMessagesInRange && sessionId) {
      activeUsers.add(sessionId);
    }
  });

  const totalUsers = activeUsers.size;
  return {
    totalUsers,
    totalMessages,
    imagesGenerated,
    avgMessagesPerUser: totalUsers > 0 ? Math.round(totalMessages / totalUsers) : 0,
    toolErrorRate: toolCalls > 0 ? Math.round((toolErrors / toolCalls) * 100) : 0,
  };
}

function computeDelta(current, previous) {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;
  if (previousValue <= 0) {
    return undefined;
  }
  return ((currentValue - previousValue) / previousValue) * 100;
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

function ClearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
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

export default function InsightsClient({ insights }) {
  const { isRefreshing, refresh } = useRefresh();
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateRange, setDateRange] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [allChats, setAllChats] = useState([]);
  const calendarBtnRef = useRef(null);
  const normalizedDateRange = normalizeDateRange(dateRange);

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
      setRefreshKey((k) => k + 1);
    }, 20000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/chats")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch chats (${response.status})`);
        }
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) {
          setAllChats(Array.isArray(payload) ? payload : []);
        }
      })
      .catch((error) => {
        console.error("[insights] failed to fetch chats for activity filter:", error?.message || error);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const allMessageDates = useMemo(() => {
    return (insights?.messagesByDate || [])
      .map((entry) => String(entry?.date || "").slice(0, 10))
      .filter(Boolean);
  }, [insights?.messagesByDate]);

  const latestAvailableDay = useMemo(() => {
    const fromInsights = [...allMessageDates].sort((a, b) => b.localeCompare(a))[0] || null;
    if (fromInsights) {
      return fromInsights;
    }

    const fromChats = (Array.isArray(allChats) ? allChats : [])
      .flatMap((chat) => (Array.isArray(chat?.messages) ? chat.messages : []))
      .map((message) => getMessageDay(message))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))[0];

    return fromChats || new Date().toISOString().slice(0, 10);
  }, [allChats, allMessageDates]);

  const effectiveCurrentRange = useMemo(() => {
    if (normalizedDateRange) {
      return normalizedDateRange;
    }

    const end = latestAvailableDay;
    const start = shiftIsoDay(end, -29);
    if (!start || !end) {
      return null;
    }

    return { start, end };
  }, [latestAvailableDay, normalizedDateRange]);

  const previousDateRange = useMemo(() => {
    if (!effectiveCurrentRange?.start || !effectiveCurrentRange?.end) {
      return null;
    }

    const rangeLength = getRangeLengthInDays(effectiveCurrentRange);
    if (rangeLength <= 0) {
      return null;
    }

    const end = shiftIsoDay(effectiveCurrentRange.start, -1);
    const start = shiftIsoDay(end, -(rangeLength - 1));
    if (!start || !end) {
      return null;
    }

    return { start, end };
  }, [effectiveCurrentRange]);

  const filteredMessagesByDate = useMemo(() => {
    const source = Array.isArray(insights?.messagesByDate) ? insights.messagesByDate : [];
    if (!normalizedDateRange) {
      return source;
    }

    return source.filter((entry) => {
      const day = String(entry?.date || "").slice(0, 10);
      return day && day >= normalizedDateRange.start && day <= normalizedDateRange.end;
    });
  }, [insights?.messagesByDate, normalizedDateRange]);

  const filteredMessageTypeBreakdown = useMemo(() => {
    return filteredMessagesByDate.reduce(
      (accumulator, entry) => ({
        human: accumulator.human + (Number(entry?.human) || 0),
        ai: accumulator.ai + (Number(entry?.ai) || 0),
        tool: accumulator.tool + (Number(entry?.tool) || 0),
      }),
      { human: 0, ai: 0, tool: 0 }
    );
  }, [filteredMessagesByDate]);

  const filteredOverview = useMemo(() => {
    const baseOverview =
      insights?.overview && typeof insights.overview === "object" ? insights.overview : {};

    if (!normalizedDateRange) {
      return baseOverview;
    }

    const totalUsers = Number(baseOverview.totalUsers) || 0;
    const totalMessages = filteredMessagesByDate.reduce(
      (sum, entry) => sum + (Number(entry?.total) || 0),
      0
    );

    return {
      ...baseOverview,
      totalMessages,
      avgMessagesPerUser: totalUsers > 0 ? Math.round(totalMessages / totalUsers) : 0,
    };
  }, [filteredMessagesByDate, insights?.overview, normalizedDateRange]);

  const fallbackActivityByDateHour = useMemo(() => computeDateHourBuckets(allChats), [allChats]);
  const activityByDateHourSource =
    Array.isArray(insights?.activityByDateHour) && insights.activityByDateHour.length > 0
      ? insights.activityByDateHour
      : fallbackActivityByDateHour;

  const filteredActivityByDateHour = useMemo(() => {
    const source = Array.isArray(activityByDateHourSource) ? activityByDateHourSource : [];
    if (!normalizedDateRange) {
      return source;
    }

    return source.filter((entry) => {
      const day = String(entry?.date || "").slice(0, 10);
      return day && day >= normalizedDateRange.start && day <= normalizedDateRange.end;
    });
  }, [activityByDateHourSource, normalizedDateRange]);

  const filteredToolUsage = useMemo(() => {
    const fallback = Array.isArray(insights?.toolUsage) ? insights.toolUsage : [];
    if (!normalizedDateRange) {
      return fallback;
    }

    const toolUsage = new Map();
    (Array.isArray(allChats) ? allChats : []).forEach((chat) => {
      const messages = Array.isArray(chat?.messages) ? chat.messages : [];
      messages.forEach((message, index) => {
        if (!isMessageInRange(message, normalizedDateRange) || !isToolMessage(message)) {
          return;
        }

        const toolName = resolveToolName(message, messages, index);
        const toolStats = toolUsage.get(toolName) || { calls: 0, errors: 0 };
        toolStats.calls += 1;
        if (isToolErrorMessage(message)) {
          toolStats.errors += 1;
        }
        toolUsage.set(toolName, toolStats);
      });
    });

    return Array.from(toolUsage.entries())
      .map(([name, counts]) => ({
        name,
        calls: counts.calls,
        errors: counts.errors,
        successRate:
          counts.calls > 0 ? Math.round(((counts.calls - counts.errors) / counts.calls) * 100) : 0,
      }))
      .sort((a, b) => {
        if (b.calls !== a.calls) {
          return b.calls - a.calls;
        }
        return a.name.localeCompare(b.name);
      });
  }, [allChats, insights?.toolUsage, normalizedDateRange]);

  const filteredTopUsers = useMemo(() => {
    const fallback = Array.isArray(insights?.topUsers) ? insights.topUsers : [];
    if (!normalizedDateRange) {
      return fallback;
    }

    const usernamesBySession = new Map();
    fallback.forEach((entry) => {
      const sessionId = String(entry?.sessionId || "").trim();
      if (!sessionId) {
        return;
      }
      usernamesBySession.set(sessionId, entry?.username || null);
    });

    const messageCounts = new Map();
    (Array.isArray(allChats) ? allChats : []).forEach((chat) => {
      const sessionId = String(chat?.sessionId || "").trim();
      if (!sessionId) {
        return;
      }

      const messages = Array.isArray(chat?.messages) ? chat.messages : [];
      const inRangeCount = messages.reduce(
        (count, message) => count + (isMessageInRange(message, normalizedDateRange) ? 1 : 0),
        0
      );
      if (inRangeCount > 0) {
        messageCounts.set(sessionId, (messageCounts.get(sessionId) || 0) + inRangeCount);
      }
    });

    return Array.from(messageCounts.entries())
      .map(([sessionId, messageCount]) => ({
        sessionId,
        messageCount,
        username: usernamesBySession.get(sessionId) || null,
      }))
      .sort((a, b) => {
        if (b.messageCount !== a.messageCount) {
          return b.messageCount - a.messageCount;
        }
        return a.sessionId.localeCompare(b.sessionId);
      });
  }, [allChats, insights?.topUsers, normalizedDateRange]);

  const currentOverviewForDelta = useMemo(
    () => computeOverviewForRange(allChats, effectiveCurrentRange),
    [allChats, effectiveCurrentRange]
  );

  const previousOverview = useMemo(
    () => computeOverviewForRange(allChats, previousDateRange),
    [allChats, previousDateRange]
  );

  const deltas = useMemo(
    () => ({
      totalUsers: computeDelta(currentOverviewForDelta.totalUsers, previousOverview.totalUsers),
      totalMessages: computeDelta(
        currentOverviewForDelta.totalMessages,
        previousOverview.totalMessages
      ),
      imagesGenerated: computeDelta(
        currentOverviewForDelta.imagesGenerated,
        previousOverview.imagesGenerated
      ),
      avgMessagesPerUser: computeDelta(
        currentOverviewForDelta.avgMessagesPerUser,
        previousOverview.avgMessagesPerUser
      ),
      toolErrorRate: computeDelta(
        currentOverviewForDelta.toolErrorRate,
        previousOverview.toolErrorRate
      ),
    }),
    [currentOverviewForDelta, previousOverview]
  );

  const dateRangeLabel = normalizedDateRange
    ? normalizedDateRange.start === normalizedDateRange.end
      ? formatDayLabel(normalizedDateRange.start)
      : `${formatDayLabel(normalizedDateRange.start)} - ${formatDayLabel(normalizedDateRange.end)}`
    : "All dates";

  return (
    <div className={styles.page}>
      <Sidebar />

      <main className={`${styles.main} ${isRefreshing ? styles.contentRefreshing : ""}`}>
        {isRefreshing && <div className={styles.refreshBar} aria-hidden="true" />}
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Insights</h1>
            <p className={styles.subtitle}>Analytics from users and chats collections</p>
          </div>

          <div className={styles.filterWrap}>
            {normalizedDateRange && (
              <div className={styles.dateChip}>
                <span>{dateRangeLabel}</span>
                <button
                  type="button"
                  onClick={() => setDateRange(null)}
                  className={styles.dateChipClear}
                  aria-label="Clear date range"
                >
                  <ClearIcon />
                </button>
              </div>
            )}

            <button
              type="button"
              ref={calendarBtnRef}
              className={`${styles.calendarButton} ${normalizedDateRange ? styles.calendarButtonActive : ""}`}
              onClick={() => setCalendarOpen((open) => !open)}
              aria-expanded={calendarOpen}
              aria-label="Filter insights by date range"
            >
              <CalendarIcon />
              <span>{dateRangeLabel}</span>
            </button>

            <CalendarPopup
              isOpen={calendarOpen}
              onClose={() => setCalendarOpen(false)}
              anchorRef={calendarBtnRef}
            >
              <Calendar
                mode="range"
                selectedRange={normalizedDateRange}
                highlightedDates={allMessageDates}
                initialMonth={normalizedDateRange?.start || allMessageDates[0] || null}
                onSelect={(range) => {
                  setDateRange(range);
                  setCalendarOpen(false);
                }}
              />
            </CalendarPopup>
          </div>
        </header>

        <div className={styles.scrollContent}>
          <MetricsStrip overview={filteredOverview} deltas={deltas} loading={isRefreshing} />

          <section className={styles.grid}>
            <div className={styles.spanTwo}>
              <MessageTrendChart data={filteredMessagesByDate} dateRange={normalizedDateRange} />
            </div>
            <MessageTypeChart data={filteredMessageTypeBreakdown} />
            <div className={styles.toolUsageCell}>
              <ToolUsageChart data={filteredToolUsage} />
            </div>
            <div className={styles.spanTwo}>
              <TopUsersTable users={filteredTopUsers} />
            </div>
            <div className={styles.spanThree}>
              <ActivityByHourChart
                data={insights?.activityByHour || []}
                dayHourData={filteredActivityByDateHour}
                dateRange={normalizedDateRange}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
