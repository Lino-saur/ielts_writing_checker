"use client";

import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { getRevisionCategoryLabel } from "@/lib/ielts/revision-categories";
import type { WritingReviewStats } from "@/lib/types";

const PIE_COLORS = ["#2f7b5f", "#d97a31", "#4b6cb7", "#9a5de6", "#d4577b", "#2f9db3", "#8f8546", "#5e7286"];

function formatShortDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    month: "numeric",
    day: "numeric"
  }).format(new Date(value));
}

type HistoryChartProps = {
  stats: WritingReviewStats | null;
  locale: string;
  emptyLabel: string;
};

export function PieChart({ stats, locale, emptyLabel }: HistoryChartProps) {
  const size = 280;
  const segments = (stats?.grammarCategoryBreakdown ?? []).map((item) => ({
    ...item,
    name: getRevisionCategoryLabel(item.category, locale === "zh-CN" ? "zh-CN" : "en")
  }));

  if (!segments.length) {
    return <div className="historyChartEmpty">{emptyLabel}</div>;
  }

  return (
    <div className="historyChartPanel">
      <ResponsiveContainer width="100%" height={size + 120}>
        <RechartsPieChart>
          <Pie
            data={segments}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="42%"
            outerRadius={96}
            labelLine={false}
            label={({ cx, cy, midAngle = 0, outerRadius = 0, percent = 0, value }) => {
              const radius = outerRadius * (percent < 0.08 ? 1.18 : 0.62);
              const radian = Math.PI / 180;
              const x = cx + radius * Math.cos(-midAngle * radian);
              const y = cy + radius * Math.sin(-midAngle * radian);
              return (
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="historyPieLabel">
                  <tspan x={x} dy="-0.2em">
                    {value}
                  </tspan>
                  <tspan x={x} dy="1.2em">
                    {(percent * 100).toFixed(1)}%
                  </tspan>
                </text>
              );
            }}
          >
            {segments.map((item, index) => (
              <Cell key={item.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, entry) => [
              `${Number(value ?? 0)} (${entry.payload.percentage.toFixed(1)}%)`,
              entry.payload.name
            ]}
          />
          <Legend verticalAlign="bottom" height={72} iconType="circle" />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreTrendChart({ stats, locale, emptyLabel }: HistoryChartProps) {
  const points = stats?.scoreTrend ?? [];
  if (!points.length) {
    return <div className="historyChartEmpty">{emptyLabel}</div>;
  }

  const data = points.map((point, index) => ({
    ...point,
    displayDate: `${formatShortDate(point.date, locale)} · #${index + 1}`
  }));

  return (
    <div className="historyChartPanel">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 24, right: 20, left: 8, bottom: 16 }}>
          <CartesianGrid stroke="rgba(30, 41, 59, 0.12)" strokeDasharray="4 4" />
          <XAxis dataKey="displayDate" minTickGap={28} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <YAxis domain={[0, 9]} tickCount={7} tick={{ fill: "var(--muted)", fontSize: 12 }} width={34} />
          <Tooltip formatter={(value) => [Number(value ?? 0).toFixed(1), "Band"]} labelFormatter={(label) => label} />
          <Line
            type="monotone"
            dataKey="averageScore"
            stroke="#2f7b5f"
            strokeWidth={3}
            dot={{ r: 4, fill: "#2f7b5f" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
