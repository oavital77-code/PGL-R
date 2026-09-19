import { Check, Clock, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ApprovalStation } from "@/lib/db/schema/invoicing";
import { formatDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils/cn";

export interface Decision {
  step: number;
  stationKey: string;
  stationName: string;
  decision: "approved" | "rejected";
  comment: string | null;
  decidedAt: Date;
  first: string;
  last: string;
}

interface Props {
  status: string;
  /** resolved chain once submitted; before that, the configured station names */
  chain: ApprovalStation[] | null;
  plannedStations: string[];
  step: number;
  decisions: Decision[];
}

const ORDER = ["draft", "pending_approval", "approved", "signed", "sent", "partially_paid", "paid"];

/**
 * Where the invoice stands on its way to the customer: draft → each approval station →
 * approved → issued → sent → paid. The waiting station is highlighted; a station already
 * passed shows who approved it and when.
 */
export function ApprovalStepper({ status, chain, plannedStations, step, decisions }: Props) {
  const t = useTranslations("invoices.detail");
  if (status === "cancelled") return null;
  const rank = ORDER.indexOf(status);
  const stations = chain ?? plannedStations.map((name, i) => ({ key: `planned-${i}`, name, userId: "", userName: "" }));
  const approvedAt = (i: number) => decisions.filter((d) => d.step === i + 1 && d.decision === "approved" && chain).at(-1);

  const nodes: { label: string; sub?: string; state: "done" | "current" | "todo" }[] = [];
  nodes.push({ label: t("step_draft"), state: rank > 0 ? "done" : "current" });
  stations.forEach((s, i) => {
    const n = i + 1;
    const done = rank > 1 || (status === "pending_approval" && n < step);
    const current = status === "pending_approval" && n === step;
    const d = approvedAt(i);
    nodes.push({ label: s.name, sub: done && d ? `${d.first} ${d.last} · ${formatDate(d.decidedAt)}` : current ? t("waiting_here") : s.userName || undefined, state: done ? "done" : current ? "current" : "todo" });
  });
  nodes.push({ label: t("step_approved"), state: rank > 2 ? "done" : rank === 2 ? "current" : "todo" });
  nodes.push({ label: t("step_issued"), state: rank > 3 ? "done" : rank === 3 ? "current" : "todo" });
  nodes.push({ label: t("step_sent"), state: rank > 4 ? "done" : rank === 4 ? "current" : "todo" });
  nodes.push({ label: t("step_paid"), state: rank === 6 ? "done" : rank === 5 ? "current" : "todo" });

  return (
    <ol aria-label={t("stepper")} className="flex flex-wrap items-start gap-y-3 rounded-lg border border-border bg-card p-3">
      {nodes.map((n, i) => (
        <li key={i} className="flex min-w-[140px] flex-1 items-start gap-2">
          <span
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
              n.state === "done" && "border-success bg-success text-white",
              n.state === "current" && "border-primary bg-primary text-white",
              n.state === "todo" && "border-border bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {n.state === "done" ? <Check className="h-3.5 w-3.5" /> : n.state === "current" ? <Clock className="h-3.5 w-3.5" /> : i}
          </span>
          <span className="min-w-0">
            <span className={cn("block text-sm", n.state === "current" ? "font-semibold text-primary" : n.state === "todo" ? "text-muted-foreground" : "")}>{n.label}</span>
            {n.sub ? <span className="block text-xs text-muted-foreground">{n.sub}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Every decision so far, oldest first. */
export function ApprovalHistory({ decisions }: { decisions: Decision[] }) {
  const t = useTranslations("invoices.detail");
  if (decisions.length === 0) return <p className="text-sm text-muted-foreground">{t("no_decisions")}</p>;
  return (
    <ul className="divide-y divide-border text-sm">
      {decisions.map((d) => (
        <li key={`${d.step}-${d.decidedAt.toISOString()}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs", d.decision === "approved" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
            {d.decision === "approved" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {d.decision === "approved" ? t("decision_approved") : t("decision_rejected")}
          </span>
          <span className="font-medium">{d.stationName}</span>
          <span className="text-muted-foreground">{t("decided_by")} {d.first} {d.last}</span>
          <span className="num text-muted-foreground">{formatDate(d.decidedAt)}</span>
          {d.comment ? <span className="basis-full text-muted-foreground">{d.comment}</span> : null}
        </li>
      ))}
    </ul>
  );
}
