"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./ActivityByHourChart.module.css";
import { useThemeCssVar } from "@/utils/useThemeCssVar";

function listDaysInRange(start, end) {
  if (!start || !end) {
    return [];
  }

  const cursor = new Date(`${start}T00:00:00`);
  const finish = new Date(`${end}T00:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(finish.getTime())) {
    return [];
  }

  const days = [];
  while (cursor <= finish) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    days.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function formatShortDay(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

export default function ActivityByHourChart({ data, dayHourData, dateRange }) {
  const hasDateRange = Boolean(dateRange?.start && dateRange?.end);
  const [visible, setVisible] = useState(true);
  const hasInitialized = useRef(false);
  const primaryColor = useThemeCssVar("--color-primary", "#481d52");

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      return undefined;
    }

    setVisible(false);
    const timer = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(timer);
  }, [hasDateRange]);

  const hourlyChartData = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => {
        const source = (data || []).find((entry) => Number(entry?.hour) === hour);
        const label = `${String(hour).padStart(2, "0")}:00`;
        return {
          hour,
          label,
          count: Number(source?.count) || 0,
          tooltipLabel: label,
        };
      }),
    [data]
  );

  const dayHourChartData = useMemo(() => {
    if (!hasDateRange) {
      return [];
    }

    const allDays = listDaysInRange(dateRange?.start, dateRange?.end);
    if (allDays.length === 0) {
      return [];
    }

    const lookup = new Map();
    (dayHourData || []).forEach((entry) => {
      const date = String(entry?.date || "").slice(0, 10);
      const hour = Number(entry?.hour);
      if (!date || !Number.isInteger(hour) || hour < 0 || hour > 23) {
        return;
      }
      const key = `${date}|${hour}`;
      lookup.set(key, (lookup.get(key) || 0) + (Number(entry?.count) || 0));
    });

    return allDays.flatMap((date) =>
      Array.from({ length: 24 }, (_, hour) => {
        const hourLabel = `${String(hour).padStart(2, "0")}:00`;
        return {
          date,
          hour,
          label: `${formatShortDay(date)} ${hourLabel}`,
          count: lookup.get(`${date}|${hour}`) || 0,
          tooltipLabel: `${date} ${hourLabel}`,
        };
      })
    );
  }, [dateRange?.end, dateRange?.start, dayHourData, hasDateRange]);

  const chartData = hasDateRange ? dayHourChartData : hourlyChartData;
  const chartTitle = hasDateRange ? "Activity By Day & Hour" : "Activity By Hour";
  const tickInterval = hasDateRange ? Math.max(0, Math.ceil(chartData.length / 16) - 1) : 1;
  const wideChartWidth = Math.max(900, chartData.length * 28);

  const hasData = chartData.some((entry) => entry.count > 0);

  return (
    <article className={styles.card}>
      <h2 className={styles.title}>{chartTitle}</h2>

      {hasData ? (
        <div
          className={`${styles.chartWrap} ${hasDateRange ? styles.scrollable : ""}`}
          style={{ opacity: visible ? 1 : 0 }}
        >
          {hasDateRange ? (
            <BarChart width={wideChartWidth} height={280} data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval={tickInterval}
                angle={-25}
                textAnchor="end"
                height={50}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel || ""}
                contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #d9d9d9" }}
                labelStyle={{ color: "#111111" }}
              />
              <Bar dataKey="count" fill={primaryColor} radius={[3, 3, 0, 0]} />
            </BarChart>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={tickInterval}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel || ""}
                contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #d9d9d9" }}
                labelStyle={{ color: "#111111" }}
              />
                <Bar dataKey="count" fill={primaryColor} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      ) : (
        <p className={styles.empty}>No hourly activity available.</p>
      )}
    </article>
  );
}
