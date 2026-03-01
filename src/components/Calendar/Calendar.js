"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Calendar.module.css";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseDateKey(dateString) {
  if (!dateString) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeRange(start, end) {
  if (start <= end) {
    return { start, end };
  }
  return { start: end, end: start };
}

export default function Calendar({
  mode = "single",
  selectedDate = null,
  selectedRange = null,
  highlightedDates = [],
  onSelect,
  initialMonth = null,
}) {
  const initialViewDate =
    parseDateKey(initialMonth) ||
    parseDateKey(mode === "single" ? selectedDate : selectedRange?.start) ||
    new Date();

  const [viewYear, setViewYear] = useState(initialViewDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialViewDate.getMonth());
  const [rangeAnchor, setRangeAnchor] = useState(null);

  const highlightedSet = useMemo(() => new Set(highlightedDates), [highlightedDates]);
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  useEffect(() => {
    if (mode !== "range" || (selectedRange?.start && selectedRange?.end)) {
      setRangeAnchor(null);
    }
  }, [mode, selectedRange?.start, selectedRange?.end]);

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(viewYear, viewMonth, 1));
  }, [viewYear, viewMonth]);

  const committedRange = useMemo(() => {
    if (!selectedRange?.start || !selectedRange?.end) {
      return null;
    }
    return normalizeRange(selectedRange.start, selectedRange.end);
  }, [selectedRange?.start, selectedRange?.end]);

  const dayCells = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const startOffset = firstDayOfMonth.getDay();
    const startDate = new Date(viewYear, viewMonth, 1 - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + index);

      return {
        dayNumber: cellDate.getDate(),
        dateKey: toDateKey(cellDate),
        outsideMonth: cellDate.getMonth() !== viewMonth,
      };
    });
  }, [viewYear, viewMonth]);

  function shiftMonth(offset) {
    const next = new Date(viewYear, viewMonth + offset, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function handleSelectDay(dateKey) {
    if (mode === "single") {
      onSelect?.(dateKey);
      return;
    }

    if (!rangeAnchor) {
      setRangeAnchor(dateKey);
      return;
    }

    const range = normalizeRange(rangeAnchor, dateKey);
    onSelect?.(range);
    setRangeAnchor(null);
  }

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
        >
          {"<"}
        </button>
        <p className={styles.monthLabel}>{monthLabel}</p>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
        >
          {">"}
        </button>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className={styles.weekday}>
            {label}
          </span>
        ))}
      </div>

      <div className={styles.grid}>
        {dayCells.map((day) => {
          const isToday = day.dateKey === todayKey;
          const isSingleSelected = mode === "single" && selectedDate === day.dateKey;
          const isRangeSelected =
            mode === "range" &&
            (day.dateKey === rangeAnchor ||
              day.dateKey === selectedRange?.start ||
              day.dateKey === selectedRange?.end);
          const isInRange =
            mode === "range" &&
            !!committedRange &&
            day.dateKey >= committedRange.start &&
            day.dateKey <= committedRange.end;
          const isHighlighted = highlightedSet.has(day.dateKey);

          const classNames = [
            styles.day,
            day.outsideMonth ? styles.outsideMonth : "",
            isToday ? styles.today : "",
            isInRange ? styles.inRange : "",
            isHighlighted ? styles.highlighted : "",
            isSingleSelected || isRangeSelected ? styles.selected : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={day.dateKey}
              type="button"
              className={classNames}
              onClick={() => handleSelectDay(day.dateKey)}
            >
              {day.dayNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}
