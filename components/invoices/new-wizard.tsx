"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { createInvoiceDraftAction, submitForApprovalAction } from "@/lib/invoices/actions";
import type { invoiceableContracts } from "@/lib/invoices/queries";
import { formatMoney } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

type Row = Awaited<ReturnType<typeof invoiceableContracts>>[number];

/** Steps 1–2 of the invoice wizard (spec §11.4); steps 3–4 happen on the draft screen. */
export function NewInvoiceWizard({ contracts, initialQuery, preselect, today, defaultPeriod }: { contracts: Row[]; initialQuery: string; preselect?: string; today: string; defaultPeriod: { from: string; to: string } }) {
  const t = useTranslations("invoices.wizard");
  const tp = useTranslations("pricing");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const router = useRouter();
  const [q, setQ] = React.useState(initialQuery);
  const [contractId, setContractId] = React.useState<string | null>(preselect ?? null);
  const contract = contracts.find((c) => c.id === contractId) ?? null;
  const [subs, setSubs] = React.useState<Set<string>>(new Set());
  const [invoiceDate, setInvoiceDate] = React.useState(today);
  const [from, setFrom] = React.useState(defaultPeriod.from);
  const [to, setTo] = React.useState(defaultPeriod.to);
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (contract) setSubs(new Set(contract.subContracts.filter((s) => !s.terminal && s.statusCode !== "completed" && s.statusCode !== "cancelled").map((s) => s.id)));
  }, [contract]);
  const needsPeriod = contract?.subContracts.some((s) => subs.has(s.id) && s.pricingMethod !== "fixed_price" && s.pricingMethod !== "pct_of_cost");
  // milestone-based lines start at 0 % and need the progress typed on the draft; hours,
  // retainer and unit lines come out of the wizard with their amounts and can go straight to approval
  const autoAmounts = !!contract && subs.size > 0 && contract.subContracts.every((s) => !subs.has(s.id) || (s.pricingMethod !== "fixed_price" && s.pricingMethod !== "pct_of_cost"));
  const create = (submit: boolean) =>
    start(async () => {
      const res = await createInvoiceDraftAction({ contractId: contract!.id, subContractIds: [...subs], invoiceDate, periodFrom: needsPeriod ? from : undefined, periodTo: needsPeriod ? to : undefined });
      if (!res.ok) return void toast.error(tAll.has(res.error) ? tAll(res.error) : res.error);
      if (submit) {
        const sub = await submitForApprovalAction(res.data.id);
        if (!sub.ok) toast.error(tAll.has(sub.error) ? tAll(sub.error) : sub.error);
        else toast.success(t("submitted"));
      } else toast.success(tc("saved"));
      router.push(`/invoices/${res.data.id}`);
    });
  const filtered = q ? contracts.filter((c) => `${c.workNumber} ${c.projectName} ${c.clientName} ${c.name}`.includes(q)) : contracts;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>1. {t("step1")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} />
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground">{t("no_contracts")}</p> : null}
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
            {filtered.map((c) => (
              <li key={c.id}>
                <button onClick={() => setContractId(c.id)} className={cn("flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-muted", contractId === c.id && "bg-brand-50")}>
                  <span>
                    <span className="num font-medium">{c.workNumber}</span> – {c.projectName} <span className="text-muted-foreground">· {c.numberInProject}. {c.name}</span>
                    <div className="text-xs text-muted-foreground">{c.clientName}</div>
                  </span>
                  <span className="num text-xs">{c.remaining === null ? <Badge variant="muted">{t("open_method")}</Badge> : `${t("remaining")}: ${formatMoney(c.remaining)}`}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>2. {t("step2")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!contract ? <p className="text-sm text-muted-foreground">{t("step1")}…</p> : (
            <>
              <Field label={t("select_subs")}>
                <div className="space-y-1">
                  {contract.subContracts.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={subs.has(s.id)} onChange={(e) => setSubs((prev) => { const n = new Set(prev); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} />
                      <span>{s.isDefault ? contract.name : s.name}</span>
                      <span className="text-xs text-muted-foreground">{tp(s.pricingMethod)}{s.remaining !== null ? ` · ${formatMoney(s.remaining)}` : ""}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field label={t("invoice_date")} htmlFor="inv-date" required>
                <Input id="inv-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </Field>
              {needsPeriod ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("period_from")} htmlFor="p-from">
                    <Input id="p-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </Field>
                  <Field label={t("period_to")} htmlFor="p-to">
                    <Input id="p-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </Field>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button disabled={pending || subs.size === 0} onClick={() => create(false)}>
                  {t("create_draft")}
                </Button>
                {autoAmounts ? (
                  <Button variant="secondary" disabled={pending} onClick={() => create(true)}>
                    {t("create_and_submit")}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{autoAmounts ? t("create_and_submit_hint") : t("create_draft_hint")}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
