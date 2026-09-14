"use client";
import { ChevronDown, ChevronLeft, Download, FileText, Play, Printer, Save, Clock, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { addNoteFromReportAction, deleteScheduleAction, deleteTemplateAction, runReportAction, runReportCompareAction, saveScheduleAction, saveTemplateAction } from "@/lib/reports/actions";
import type { FilterData } from "@/lib/reports/filter-data";
import type { FilterKey, ReportGroup, ReportParams, ReportResult, ReportRow } from "@/lib/reports/types";
import { formatDate, formatMoney, formatPct } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { ReportChart, type ChartDatum } from "./report-chart";

interface Def {
  key: string;
  group: ReportGroup;
  filters: FilterKey[];
  groupByOptions: string[];
  chartOptions: { metric: string; kinds: ("bar" | "line" | "pie")[] }[];
}

interface Props {
  defs: Def[];
  data: FilterData;
  initialKey: string;
  initialParams: Record<string, unknown>;
  canSchedule: boolean;
  canShare: boolean;
  title: string;
}

const GROUP_ORDER: ReportGroup[] = ["hours", "financial", "contracts", "suppliers", "payroll", "system"];

function quickRange(kind: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  switch (kind) {
    case "month":
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case "prev_month":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "quarter": {
      const q = Math.floor(m / 3) * 3;
      return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) };
    }
    case "prev_year":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default:
      return { from: `${y}-01-01`, to: iso(now) };
  }
}

function fmtCell(type: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  switch (type) {
    case "money":
      return formatMoney(Number(v));
    case "pct":
      return formatPct(Number(v), 1);
    case "hours":
      return Number(v).toFixed(2);
    case "number":
      return String(v);
    case "date":
      return formatDate(String(v));
    default:
      return String(v);
  }
}

export function ReportBuilder({ defs, data, initialKey, initialParams, canSchedule, canShare, title }: Props) {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const router = useRouter();
  const [key, setKey] = React.useState(initialKey);
  const def = defs.find((d) => d.key === key) ?? defs[0]!;
  const [params, setParams] = React.useState<ReportParams>({ ...quickRange("year"), ...initialParams });
  const [result, setResult] = React.useState<ReportResult | null>(null);
  const [prev, setPrev] = React.useState<ReportResult | null>(null);
  const [visible, setVisible] = React.useState<string[] | null>(null);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [showTotals, setShowTotals] = React.useState(true);
  const [chartKind, setChartKind] = React.useState<"none" | "bar" | "line" | "pie">("none");
  const [chartMetric, setChartMetric] = React.useState<string>("");
  const [sort, setSort] = React.useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [pending, start] = React.useTransition();
  const [tplOpen, setTplOpen] = React.useState(false);
  const [schOpen, setSchOpen] = React.useState(false);
  const chartRef = React.useRef<HTMLDivElement>(null);

  const has = (f: FilterKey) => def.filters.includes(f);
  const set = (patch: Partial<ReportParams>) => setParams((p) => ({ ...p, ...patch }));
  const multi = (k: keyof ReportParams, values: string[]) => set({ [k]: values.length ? values : undefined } as Partial<ReportParams>);

  const run = () =>
    start(async () => {
      const res = await runReportAction(def.key, params);
      if (!res.ok) return void toast.error(tAll.has(res.error) ? tAll(res.error) : res.error);
      setResult(res.data);
      setVisible((v) => v ?? res.data.columns.filter((c) => !c.hidden).map((c) => c.key));
      setCollapsed(new Set(res.data.rows.filter((r) => r.level >= 2).map((r) => r.parentId!).filter(Boolean)));
      if (params.compare) {
        const p = await runReportCompareAction(def.key, params);
        setPrev(p.ok ? p.data : null);
      } else setPrev(null);
    });

  React.useEffect(() => {
    setResult(null);
    setVisible(null);
    setChartMetric(def.chartOptions[0]?.metric ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.key]);
  React.useEffect(() => {
    if (initialKey) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = result?.columns.filter((c) => visible?.includes(c.key)) ?? [];
  const rowsVisible = React.useMemo(() => {
    if (!result) return [];
    const hidden = new Set<string>();
    for (const r of result.rows) if (r.parentId && (collapsed.has(r.parentId) || hidden.has(r.parentId))) hidden.add(r.id);
    let rows = result.rows.filter((r) => !hidden.has(r.id));
    if (sort) {
      const top = rows.filter((r) => r.level === 0);
      const cmp = (a: ReportRow, b: ReportRow) => {
        const av = a.cells[sort.key];
        const bv = b.cells[sort.key];
        const r = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""));
        return r * sort.dir;
      };
      top.sort(cmp);
      const out: ReportRow[] = [];
      const push = (r: ReportRow) => {
        out.push(r);
        rows.filter((x) => x.parentId === r.id).sort(cmp).forEach(push);
      };
      top.forEach(push);
      rows = out;
    }
    return rows;
  }, [result, collapsed, sort]);

  const chartData: ChartDatum[] = React.useMemo(() => {
    if (!result || chartKind === "none" || !chartMetric) return [];
    const top = result.rows.filter((r) => r.level === 0).slice(0, 30);
    return top.map((r) => ({ name: String(r.cells.name ?? r.cells.month ?? r.cells.employee ?? r.cells.number ?? r.id).slice(0, 40), value: Number(r.cells[chartMetric] ?? 0), prev: prev ? Number(prev.rows.find((x) => x.id === r.id)?.cells[chartMetric] ?? 0) : undefined }));
  }, [result, prev, chartKind, chartMetric]);

  const filtersDescription = () => {
    const parts: string[] = [];
    if (params.from) parts.push(`${formatDate(params.from)} – ${formatDate(params.to)}`);
    if (params.month) parts.push(params.month);
    return parts.join(" · ");
  };

  const exportFile = async (format: "xlsx" | "pdf") => {
    if (!result || !visible) return;
    let chartPng: string | undefined;
    if (format === "pdf" && chartKind !== "none" && chartRef.current) {
      const svg = chartRef.current.querySelector("svg");
      if (svg) {
        const xml = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
        await new Promise((r) => (img.onload = r));
        const canvas = document.createElement("canvas");
        canvas.width = svg.clientWidth * 2;
        canvas.height = svg.clientHeight * 2;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        chartPng = canvas.toDataURL("image/png");
      }
    }
    const res = await fetch("/api/exports/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: def.key, params, visible, format, chartPng, filters: filtersDescription() }) });
    if (!res.ok) return void toast.error(tc("error"));
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${def.key.replace(/\./g, "_")}.${format}`;
    a.click();
  };

  const loadTemplate = (id: string) => {
    const tpl = data.templates.find((x) => x.id === id);
    if (!tpl) return;
    const cfg = tpl.config as { params?: ReportParams; visible?: string[]; chartKind?: typeof chartKind; chartMetric?: string; showTotals?: boolean };
    setKey(tpl.reportType);
    setTimeout(() => {
      setParams(cfg.params ?? {});
      setVisible(cfg.visible ?? null);
      setChartKind(cfg.chartKind ?? "none");
      setChartMetric(cfg.chartMetric ?? "");
      setShowTotals(cfg.showTotals ?? true);
    }, 0);
  };

  const MultiSelect = ({ label, k, options }: { label: string; k: keyof ReportParams; options: { id: string; name: string }[] }) => (
    <Field label={label}>
      <select multiple value={(params[k] as string[] | undefined) ?? []} onChange={(e) => multi(k, [...e.target.selectedOptions].map((o) => o.value))} className="h-24 w-full rounded-md border border-input bg-card px-2 text-sm">
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </Field>
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* sidebar (right in RTL) */}
      <aside className="no-print w-full shrink-0 rounded-lg border border-border bg-card p-2 lg:w-64">
        <h1 className="px-2 py-1 text-lg font-bold">{title}</h1>
        {GROUP_ORDER.filter((g) => defs.some((d) => d.group === g)).map((g) => (
          <div key={g} className="mb-2">
            <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">{t(`groups.${g}`)}</div>
            {defs.filter((d) => d.group === g).map((d) => (
              <button key={d.key} onClick={() => setKey(d.key)} className={cn("block w-full rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted", d.key === def.key && "bg-brand-50 font-medium text-primary")}>{t(`names.${d.key}`)}</button>
            ))}
          </div>
        ))}
        {data.templates.length ? (
          <div className="mt-2 border-t border-border pt-2">
            <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">{t("templates")}</div>
            {data.templates.map((tp) => (
              <div key={tp.id} className="flex items-center gap-1 px-1">
                <button onClick={() => loadTemplate(tp.id)} className="flex-1 truncate rounded-md px-1 py-1 text-start text-sm hover:bg-muted">{tp.name}{tp.isShared ? <Badge variant="secondary" className="ms-1">{t("shared")}</Badge> : null}</button>
                {tp.mine || canShare ? <button onClick={() => deleteTemplateAction(tp.id).then(() => router.refresh())} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button> : null}
              </div>
            ))}
          </div>
        ) : null}
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <h2 className="text-xl font-bold">{t(`names.${def.key}`)}</h2>
        {/* filters */}
        <div className="no-print grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-3 xl:grid-cols-4">
          {has("dateRange") ? (
            <>
              <Field label={t("date_range")}>
                <div className="flex gap-1">
                  <Input type="date" value={params.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} />
                  <Input type="date" value={params.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} />
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {["month", "prev_month", "quarter", "year", "prev_year"].map((q) => (
                    <button key={q} onClick={() => set(quickRange(q))} className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-muted">{t(`quick.${q}`)}</button>
                  ))}
                </div>
              </Field>
            </>
          ) : null}
          {has("month") ? <Field label={t("month")}><Input type="month" value={params.month ?? new Date().toISOString().slice(0, 7)} onChange={(e) => set({ month: e.target.value })} /></Field> : null}
          {has("clients") && data.clients.length ? <MultiSelect label={t("clients")} k="clientIds" options={data.clients} /> : null}
          {has("projects") ? <MultiSelect label={t("projects")} k="projectIds" options={data.projects.map((p) => ({ id: p.id, name: p.label }))} /> : null}
          {has("subContracts") ? <MultiSelect label={t("sub_contracts")} k="subContractIds" options={data.subContracts.filter((s) => !params.projectIds?.length || params.projectIds.includes(s.projectId)).map((s) => ({ id: s.id, name: s.label }))} /> : null}
          {has("departments") ? <MultiSelect label={t("departments")} k="departmentIds" options={data.departments} /> : null}
          {has("users") ? <MultiSelect label={t("employees")} k="userIds" options={data.users.filter((u) => params.includeInactive || u.isActive)} /> : null}
          {has("pms") ? <MultiSelect label={t("project_managers")} k="pmIds" options={data.pms} /> : null}
          {has("statuses") ? <MultiSelect label={t("statuses")} k="statusCodes" options={data.statuses.map((s) => ({ id: s.code, name: s.name }))} /> : null}
          {has("pricingMethods") ? <MultiSelect label={t("pricing_methods")} k="pricingMethods" options={["fixed_price", "hourly", "retainer", "pct_of_cost", "per_unit"].map((m) => ({ id: m, name: tAll(`pricing.${m}`) }))} /> : null}
          {has("suppliers") && data.suppliers.length ? <MultiSelect label={t("suppliers")} k="supplierIds" options={data.suppliers} /> : null}
          {has("invoiceStatuses") ? <MultiSelect label={t("invoice_statuses")} k="invoiceStatuses" options={["draft", "pending_approval", "approved", "signed", "sent", "partially_paid", "paid", "cancelled"].map((s) => ({ id: s, name: tAll(`invoices.status.${s}`) }))} /> : null}
          {has("incomeMode") ? <Field label={t("income_mode")}><Select value={params.incomeMode ?? "submitted"} onChange={(e) => set({ incomeMode: e.target.value as ReportParams["incomeMode"] })}><option value="submitted">{t("income_submitted")}</option><option value="completed_milestones">{t("income_completed")}</option></Select></Field> : null}
          {def.groupByOptions.length ? <Field label={t("group_by")}><Select value={params.groupBy?.[0] ?? ""} onChange={(e) => set({ groupBy: e.target.value ? [e.target.value] : undefined })}><option value="">—</option>{def.groupByOptions.map((g) => <option key={g} value={g}>{t(`group_by_options.${g}`)}</option>)}</Select></Field> : null}
          <div className="flex flex-col gap-1 pt-5 text-sm">
            {has("includeInactive") ? <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(params.includeInactive)} onChange={(e) => set({ includeInactive: e.target.checked })} /> {t("include_inactive")}</label> : null}
            {has("showMonths") ? <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(params.showMonths)} onChange={(e) => set({ showMonths: e.target.checked })} /> {t("show_months")}</label> : null}
            {has("dateRange") ? <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(params.compare)} onChange={(e) => set({ compare: e.target.checked })} /> {t("compare")}</label> : null}
            <label className="flex items-center gap-2"><input type="checkbox" checked={showTotals} onChange={(e) => setShowTotals(e.target.checked)} /> {t("show_totals")}</label>
          </div>
        </div>

        {/* toolbar */}
        <div className="no-print flex flex-wrap items-center gap-2">
          <Button onClick={run} disabled={pending}><Play /> {t("run")}</Button>
          <Button variant="outline" onClick={() => exportFile("xlsx")} disabled={!result}><Download /> Excel</Button>
          <Button variant="outline" onClick={() => exportFile("pdf")} disabled={!result}><FileText /> PDF</Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!result}><Printer /> {tc("print")}</Button>
          <Button variant="outline" onClick={() => setTplOpen(true)} disabled={!result}><Save /> {t("save_template")}</Button>
          {canSchedule ? <Button variant="outline" onClick={() => setSchOpen(true)} disabled={!data.templates.length}><Clock /> {t("schedule")}</Button> : null}
          {def.chartOptions.length ? (
            <span className="ms-auto flex items-center gap-1 text-sm">
              <Select value={chartKind} onChange={(e) => setChartKind(e.target.value as typeof chartKind)} className="w-28"><option value="none">{t("chart_none")}</option><option value="bar">{t("chart_bar")}</option><option value="line">{t("chart_line")}</option><option value="pie">{t("chart_pie")}</option></Select>
              {chartKind !== "none" ? <Select value={chartMetric} onChange={(e) => setChartMetric(e.target.value)} className="w-36">{def.chartOptions.map((o) => <option key={o.metric} value={o.metric}>{t.has(`columns.${o.metric}`) ? t(`columns.${o.metric}`) : o.metric}</option>)}</Select> : null}
            </span>
          ) : null}
        </div>

        {/* column picker */}
        {result ? (
          <details className="no-print rounded-lg border border-border bg-card px-4 py-2 text-sm">
            <summary className="cursor-pointer">{t("columns_picker")}</summary>
            <div className="mt-2 flex flex-wrap gap-3">
              {result.columns.map((c) => (
                <label key={c.key} className="flex items-center gap-1"><input type="checkbox" checked={visible?.includes(c.key) ?? false} onChange={(e) => setVisible((v) => (e.target.checked ? [...(v ?? []), c.key] : (v ?? []).filter((k) => k !== c.key)))} /> {t.has(`columns.${c.label}`) ? t(`columns.${c.label}`) : c.label}{c.group ? <span className="text-xs text-muted-foreground">({t(`column_groups.${c.group}`)})</span> : null}</label>
              ))}
            </div>
          </details>
        ) : null}

        {chartKind !== "none" && chartData.length ? <ReportChart ref={chartRef} kind={chartKind} data={chartData} label={t.has(`columns.${chartMetric}`) ? t(`columns.${chartMetric}`) : chartMetric} prevLabel={t("previous_period")} /> : null}

        {/* table */}
        {result ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="cursor-pointer whitespace-nowrap px-3 py-2 text-start font-semibold select-none" onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}>
                      {t.has(`columns.${c.label}`) ? t(`columns.${c.label}`) : c.label}
                      {sort?.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsVisible.length === 0 ? <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">{t("empty")}</td></tr> : null}
                {rowsVisible.map((r) => {
                  const hasChildren = result.rows.some((x) => x.parentId === r.id);
                  return (
                    <tr key={r.id} className={cn("border-t border-border hover:bg-muted/40", r.level === 0 && hasChildren && "font-semibold bg-muted/20")}>
                      {columns.map((c, i) => (
                        <td key={c.key} className={cn("px-3 py-1.5 whitespace-nowrap", c.type !== "text" && "num text-end", c.type === "money" && Number(r.cells[c.key]) < 0 && "text-destructive")} style={i === 0 ? { paddingInlineStart: `${12 + r.level * 18}px` } : undefined}>
                          {i === 0 ? (
                            <span className="inline-flex items-center gap-1">
                              {hasChildren ? (
                                <button onClick={() => setCollapsed((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} className="text-muted-foreground">{collapsed.has(r.id) ? <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-0" /> : <ChevronDown className="h-3.5 w-3.5" />}</button>
                              ) : null}
                              {r.link ? <a href={r.link} className="text-primary hover:underline">{fmtCell(c.type, r.cells[c.key])}</a> : fmtCell(c.type, r.cells[c.key])}
                              {r.warnings?.map((w) => <span key={w} title={tAll(`contracts.warn_${w}`)} className="text-warning">⚠</span>)}
                            </span>
                          ) : c.editable === "note" && r.entity?.type === "contract" ? (
                            <InlineNote contractId={r.entity.id} value={String(r.cells[c.key] ?? "")} onSaved={run} />
                          ) : (
                            fmtCell(c.type, r.cells[c.key])
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              {showTotals && result.totals ? (
                <tfoot className="sticky bottom-0 border-t bg-muted/80 font-bold">
                  <tr>{columns.map((c, i) => <td key={c.key} className={cn("px-3 py-2", c.type !== "text" && "num text-end")}>{i === 0 ? tc("total") : fmtCell(c.type, result.totals![c.key])}</td>)}</tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("run_hint")}</p>
        )}
      </div>

      <TemplateDialog open={tplOpen} onClose={() => setTplOpen(false)} canShare={canShare} onSave={(name, shared) => saveTemplateAction({ name, reportType: def.key, config: { params, visible, chartKind, chartMetric, showTotals }, isShared: shared }).then((r) => { if (r.ok) { toast.success(tc("saved")); setTplOpen(false); router.refresh(); } else toast.error(r.error); })} />
      <ScheduleDialog open={schOpen} onClose={() => setSchOpen(false)} templates={data.templates} schedules={data.schedules} />
    </div>
  );
}

function InlineNote({ contractId, value, onSaved }: { contractId: string; value: string; onSaved: () => void }) {
  const [v, setV] = React.useState(value);
  const [edit, setEdit] = React.useState(false);
  React.useEffect(() => setV(value), [value]);
  if (!edit) return <button onClick={() => setEdit(true)} className="max-w-64 truncate text-start text-xs hover:underline" title={value}>{value || "…"}</button>;
  return (
    <Input value={v} autoFocus onChange={(e) => setV(e.target.value)} onBlur={() => { setEdit(false); if (v.trim() && v !== value) addNoteFromReportAction(contractId, v).then(onSaved); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(value); setEdit(false); } }} className="h-7 w-64 text-xs" />
  );
}

function TemplateDialog({ open, onClose, canShare, onSave }: { open: boolean; onClose: () => void; canShare: boolean; onSave: (name: string, shared: boolean) => void }) {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const [name, setName] = React.useState("");
  const [shared, setShared] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("save_template")}</DialogTitle></DialogHeader>
        <Field label={tc("name")} htmlFor="tpl-name" required><Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {canShare ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> {t("shared_template")}</label> : null}
        <DialogFooter><Button variant="outline" onClick={onClose}>{tc("cancel")}</Button><Button disabled={!name.trim()} onClick={() => onSave(name.trim(), shared)}>{tc("save")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({ open, onClose, templates, schedules }: { open: boolean; onClose: () => void; templates: FilterData["templates"]; schedules: FilterData["schedules"] }) {
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const tu = useTranslations("users.days");
  const router = useRouter();
  const [templateId, setTemplateId] = React.useState(templates[0]?.id ?? "");
  const [frequency, setFrequency] = React.useState<"daily" | "weekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = React.useState(0);
  const [dayOfMonth, setDayOfMonth] = React.useState(1);
  const [hour, setHour] = React.useState(7);
  const [recipients, setRecipients] = React.useState("");
  const [format, setFormat] = React.useState<"xlsx" | "pdf">("xlsx");
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{t("schedule")}</DialogTitle></DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("templates")} htmlFor="sc-tpl"><Select id="sc-tpl" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>{templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
          <Field label={t("frequency")} htmlFor="sc-freq"><Select id="sc-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}><option value="daily">{t("daily")}</option><option value="weekly">{t("weekly")}</option><option value="monthly">{t("monthly")}</option></Select></Field>
          {frequency === "weekly" ? <Field label={t("day_of_week")} htmlFor="sc-dow"><Select id="sc-dow" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>{[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{tu(String(d) as "0")}</option>)}</Select></Field> : null}
          {frequency === "monthly" ? <Field label={t("day_of_month")} htmlFor="sc-dom"><Input id="sc-dom" type="number" min="1" max="28" value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} /></Field> : null}
          <Field label={t("hour")} htmlFor="sc-hour"><Input id="sc-hour" type="number" min="0" max="23" value={hour} onChange={(e) => setHour(Number(e.target.value))} /></Field>
          <Field label={t("format")} htmlFor="sc-fmt"><Select id="sc-fmt" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}><option value="xlsx">xlsx</option><option value="pdf">pdf</option></Select></Field>
          <Field label={t("recipients")} htmlFor="sc-rcp" className="md:col-span-2"><Input id="sc-rcp" value={recipients} onChange={(e) => setRecipients(e.target.value)} className="num" placeholder="a@b.co.il, c@d.co.il" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
          <Button disabled={pending || !templateId || !recipients.trim()} onClick={() => start(async () => { const r = await saveScheduleAction({ templateId, frequency, dayOfWeek, dayOfMonth, hour, recipients: recipients.split(/[,\s;]+/).filter(Boolean), format }); if (r.ok) { toast.success(tc("saved")); router.refresh(); } else toast.error(r.error); })}>{tc("save")}</Button>
        </DialogFooter>
        {schedules.length ? (
          <ul className="divide-y divide-border text-sm">
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5">
                <span>{templates.find((x) => x.id === s.templateId)?.name ?? "?"} · {t(s.frequency)} · {s.hour}:00 · {s.recipients.join(", ")} {s.lastError ? <Badge variant="destructive">{t("failed")}</Badge> : null}</span>
                <button onClick={() => deleteScheduleAction(s.id).then(() => router.refresh())} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
