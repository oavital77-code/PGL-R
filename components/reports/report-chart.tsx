"use client";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#2a3380", "#38bdf8", "#4453bd", "#0ea5e9", "#8a97df", "#7dd3fc", "#b3bbeb", "#075985", "#161b45", "#e0f2fe"];
const fmt = (v: unknown) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(v));

export interface ChartDatum {
  name: string;
  value: number;
  prev?: number;
}

export const ReportChart = React.forwardRef<HTMLDivElement, { kind: "bar" | "line" | "pie"; data: ChartDatum[]; label: string; prevLabel?: string }>(function ReportChart({ kind, data, label, prevLabel }, ref) {
  const hasPrev = data.some((d) => d.prev !== undefined);
  return (
    <div ref={ref} className="h-72 rounded-lg border border-border bg-card p-3">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "pie" ? (
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} innerRadius={50} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={fmt} />
            <Legend />
          </PieChart>
        ) : kind === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ef" />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={fmt} orientation="right" />
            <Tooltip formatter={fmt} />
            <Legend />
            <Line type="monotone" dataKey="value" name={label} stroke="#2a3380" strokeWidth={2} dot={false} />
            {hasPrev ? <Line type="monotone" dataKey="prev" name={prevLabel} stroke="#38bdf8" strokeWidth={2} strokeDasharray="4 4" dot={false} /> : null}
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ef" />
            <XAxis dataKey="name" fontSize={11} interval={0} angle={data.length > 8 ? -30 : 0} textAnchor={data.length > 8 ? "end" : "middle"} height={data.length > 8 ? 70 : 30} />
            <YAxis fontSize={11} tickFormatter={fmt} orientation="right" />
            <Tooltip formatter={fmt} />
            <Legend />
            <Bar dataKey="value" name={label} fill="#2a3380" radius={[3, 3, 0, 0]} />
            {hasPrev ? <Bar dataKey="prev" name={prevLabel} fill="#38bdf8" radius={[3, 3, 0, 0]} /> : null}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
});
