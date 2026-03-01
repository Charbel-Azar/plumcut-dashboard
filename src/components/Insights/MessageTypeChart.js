"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import styles from "./MessageTypeChart.module.css";
import { useThemeCssVar } from "@/utils/useThemeCssVar";

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #d9d9d9",
        borderRadius: 4,
        padding: "8px 12px",
      }}
    >
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: "#111111", margin: "2px 0", fontSize: 13 }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export default function MessageTypeChart({ data }) {
  const primaryColor = useThemeCssVar("--color-primary", "#481d52");
  const colors = useMemo(
    () => ({
      Human: "#ee7418",
      AI: primaryColor,
      Tool: "#989898",
    }),
    [primaryColor]
  );

  const pieData = [
    { name: "Human", value: Number(data?.human) || 0 },
    { name: "AI", value: Number(data?.ai) || 0 },
    { name: "Tool", value: Number(data?.tool) || 0 },
  ];

  const hasData = pieData.some((entry) => entry.value > 0);
  const total = pieData.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <article className={styles.card}>
      <h2 className={styles.title}>Message Type</h2>

      {hasData ? (
        <>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={colors[entry.name]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.total}>
              <span>{total}</span>
              <small>Total</small>
            </div>
          </div>

          <ul className={styles.legend}>
            {pieData.map((entry) => (
              <li key={entry.name}>
                <span className={styles.swatch} style={{ backgroundColor: colors[entry.name] }} />
                <span>{entry.name}</span>
                <strong>{entry.value}</strong>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.empty}>No messages in this range.</p>
      )}
    </article>
  );
}
