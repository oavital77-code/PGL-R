"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#2a3380", "#38bdf8", "#8a97df", "#0ea5e9", "#4453bd", "#7dd3fc", "#b3bbeb", "#075985"];
const fmt = (v: unknown) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(v));

interface Props {
  months: { month: string; submitted: number; receipts: number }[];
  topRemaining: { name: string; remaining: number }[];
  aging: { bucket: string; amount: number }[];
  hoursByDept: { name: string; hours: number }[];
  labels: Record<string, string>;
}

export function AdminCharts({ months, topRemaining, aging, hoursByDept, labels }: Props) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{labels.chart_sub_vs_rec}</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months.map((m) => ({ ...m, label: `${m.month.slice(5)}/${m.month.slice(2, 4)}` }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ef" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={fmt} orientation="right" />
              <Tooltip formatter={fmt} />
              <Legend />
              <Bar dataKey="submitted" name={labels.submitted} fill="#2a3380" radius={[3, 3, 0, 0]} />
              <Bar dataKey="receipts" name={labels.receipts} fill="#38bdf8" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{labels.chart_top_remaining}</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {topRemaining.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">—</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRemaining} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ef" />
                <XAxis type="number" fontSize={11} tickFormatter={fmt} />
                <YAxis type="category" dataKey="name" width={160} fontSize={11} orientation="right" />
                <Tooltip formatter={fmt} />
                <Bar dataKey="remaining" name={labels.remaining} fill="#4453bd" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{labels.chart_aging}</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {aging.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">—</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aging}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3e6ef" />
                <XAxis dataKey="bucket" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={fmt} orientation="right" />
                <Tooltip formatter={fmt} />
                <Bar dataKey="amount" name={labels.amount} fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{labels.chart_hours_dept}</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {hoursByDept.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">—</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={hoursByDept} dataKey="hours" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}>
                  {hoursByDept.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toFixed(2)} ${labels.hours}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
