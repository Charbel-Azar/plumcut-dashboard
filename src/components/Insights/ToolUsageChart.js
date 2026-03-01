"use client";

import { useMemo } from "react";
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
import styles from "./ToolUsageChart.module.css";
import { useThemeCssVar } from "@/utils/useThemeCssVar";

export default function ToolUsageChart({ data }) {
  const router = useRouter();
  const chartData = useMemo(() => (data || []).slice(0, 8), [data]);
  const primaryColor = useThemeCssVar("--color-primary", "#481d52");

  const handleBarClick = (payload) => {
    const toolName = payload?.name;
    if (!toolName) {
      return;
    }

    router.push(`/chats?tool=${encodeURIComponent(toolName)}`);
  };

  return (
    <article className={styles.card}>
      <h2 className={styles.title}>Tool Usage</h2>

      {chartData.length === 0 ? (
        <p className={styles.empty}>No tool calls found.</p>
      ) : (
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              onClick={(state) => handleBarClick(state?.activePayload?.[0]?.payload)}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #d9d9d9" }}
                labelStyle={{ color: "#111111" }}
              />
              <Legend />
              <Bar dataKey="calls" fill={primaryColor} name="Calls" cursor="pointer" />
              <Bar dataKey="errors" fill="#d64545" name="Errors" cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
