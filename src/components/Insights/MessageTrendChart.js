"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./MessageTrendChart.module.css";
import { useThemeCssVar } from "@/utils/useThemeCssVar";

const GROUPINGS = ["day", "week", "month"];
const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function normalizeRange(range) {
  if (!range?.start || !range?.end) {
    return null;
  }

  return range.start <= range.end
    ? { start: range.start, end: range.end }
    : { start: range.end, end: range.start };
}

function getWeekRange(date) {
  const start = new Date(date);
  const dayOfWeek = start.getDay();
  const delta = (dayOfWeek + 6) % 7;
  start.setDate(start.getDate() - delta);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function getMonthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

function formatTickLabel(payload, grouping) {
  if (grouping === "day") {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
      new Date(`${payload.dateFrom}T00:00:00`)
    );
  }

  if (grouping === "week") {
    return `${payload.dateFrom.slice(5)} - ${payload.dateTo.slice(5)}`;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(
    new Date(`${payload.dateFrom}T00:00:00`)
  );
}

function aggregateData(data, grouping) {
  const groups = new Map();

  data.forEach((entry) => {
    const rawDate = String(entry?.date || "").slice(0, 10);
    if (!rawDate) {
      return;
    }

    const date = new Date(`${rawDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return;
    }

    let key = rawDate;
    let dateFrom = rawDate;
    let dateTo = rawDate;

    if (grouping === "week") {
      const range = getWeekRange(date);
      key = `${toDateKey(range.start)}::${toDateKey(range.end)}`;
      dateFrom = toDateKey(range.start);
      dateTo = toDateKey(range.end);
    } else if (grouping === "month") {
      const range = getMonthRange(date);
      key = toMonthKey(date);
      dateFrom = toDateKey(range.start);
      dateTo = toDateKey(range.end);
    }

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        dateFrom,
        dateTo,
        human: 0,
        ai: 0,
        tool: 0,
        total: 0,
      });
    }

    const group = groups.get(key);
    group.human += Number(entry?.human) || 0;
    group.ai += Number(entry?.ai) || 0;
    group.tool += Number(entry?.tool) || 0;
    group.total += Number(entry?.total) || 0;
  });

  return Array.from(groups.values())
    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
    .map((group) => ({
      ...group,
      label: formatTickLabel(group, grouping),
    }));
}

export default function MessageTrendChart({ data, dateRange }) {
  const [grouping, setGrouping] = useState("day");
  const router = useRouter();
  const primaryColor = useThemeCssVar("--color-primary", "#481d52");

  const windowedData = useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    if (source.length === 0) {
      return [];
    }

    const sortedData = source
      .map((entry) => {
        const day = String(entry?.date || "").slice(0, 10);
        if (!ISO_DAY_PATTERN.test(day)) {
          return null;
        }

        const parsedDay = new Date(`${day}T00:00:00`);
        if (Number.isNaN(parsedDay.getTime())) {
          return null;
        }

        return { entry, day, parsedDay };
      })
      .filter(Boolean)
      .sort((a, b) => a.day.localeCompare(b.day));

    if (sortedData.length === 0) {
      return [];
    }

    const parentRange = normalizeRange(dateRange);
    if (parentRange) {
      return sortedData
        .filter((item) => item.day >= parentRange.start && item.day <= parentRange.end)
        .map((item) => item.entry);
    }

    if (grouping === "month") {
      return sortedData.map((item) => item.entry);
    }

    const latestDay = sortedData[sortedData.length - 1].parsedDay;
    if (grouping === "day") {
      const windowStart = new Date(latestDay);
      windowStart.setDate(windowStart.getDate() - 29);
      const start = toDateKey(windowStart);
      const end = toDateKey(latestDay);
      return sortedData
        .filter((item) => item.day >= start && item.day <= end)
        .map((item) => item.entry);
    }

    const latestWeek = getWeekRange(latestDay);
    const weekWindowStart = new Date(latestWeek.start);
    weekWindowStart.setDate(weekWindowStart.getDate() - 11 * 7);
    const start = toDateKey(weekWindowStart);
    const end = toDateKey(latestWeek.end);
    return sortedData
      .filter((item) => item.day >= start && item.day <= end)
      .map((item) => item.entry);
  }, [data, dateRange?.end, dateRange?.start, grouping]);

  const chartData = useMemo(() => aggregateData(windowedData, grouping), [grouping, windowedData]);

  const handleDrillDown = (payload) => {
    if (!payload?.dateFrom || !payload?.dateTo) {
      return;
    }
    router.push(
      `/chats?dateFrom=${encodeURIComponent(payload.dateFrom)}&dateTo=${encodeURIComponent(payload.dateTo)}`
    );
  };

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Message Trend</h2>
        <div className={styles.toggle} role="tablist" aria-label="Group messages by">
          {GROUPINGS.map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.toggleBtn} ${grouping === key ? styles.toggleBtnActive : ""}`}
              onClick={() => setGrouping(key)}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className={styles.empty}>No messages in this range.</p>
      ) : (
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              onClick={(state) => {
                const payload = state?.activePayload?.[0]?.payload;
                handleDrillDown(payload);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #d9d9d9" }}
                labelStyle={{ color: "#111111" }}
              />
              <Legend />
              <Bar dataKey="human" stackId="messages" fill="#ee7418" cursor="pointer" />
              <Bar dataKey="ai" stackId="messages" fill={primaryColor} cursor="pointer" />
              <Bar dataKey="tool" stackId="messages" fill="#989898" cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
