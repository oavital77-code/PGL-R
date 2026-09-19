"use client";
import { CheckCircle2, Eye, FileMinus, PenLine, RotateCcw, Send, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { approveInvoiceAction, backToDraftAction, cancelInvoiceAction, createCreditInvoiceAction, previewInvoicePdfAction, rejectInvoiceAction, sendDefaultsAction, sendInvoiceAction, signInvoiceAction, submitForApprovalAction } from "@/lib/invoices/actions";
import { ActionButton } from "@/components/shared/action-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  invoice: { id: string; status: string; kind: "proforma" | "credit"; pdfDocumentId: string | null; hasReceipts: boolean };
  /** decide: this user is at the invoice's current approval station (or is an admin) */
  caps: { create: boolean; decide: boolean; sign: boolean; send: boolean; cancel: boolean; admin: boolean };
  signatureMode: "manual" | "digital";
  signers: { id: string; name: string }[];
  lines: { id: string; description: string; amount: number; type: string }[];
}

/** Status transitions (spec §11.3). */
export function WorkflowBar({ invoice, caps, signatureMode, signers, lines }: Props) {
  const t = useTranslations("invoices.detail");
  const tAll = useTranslations();
  const router = useRouter();
  const [signer, setSigner] = React.useState(signers[0]?.id ?? "");
  const [pending, start] = React.useTransition();
  const s = invoice.status;
  const preview = () =>
    start(async () => {
      const res = await previewInvoicePdfAction(invoice.id);
      if (!res.ok) return void toast.error(tAll.has(res.error) ? tAll(res.error) : res.error);
      const blob = new Blob([Uint8Array.from(atob(res.data.base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      window.open(URL.createObjectURL(blob), "_blank");
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={preview} disabled={pending}><Eye /> {t("preview")}</Button>
      {s === "draft" && caps.create ? <ActionButton action={() => submitForApprovalAction(invoice.id)}><CheckCircle2 /> {t("submit")}</ActionButton> : null}
      {s === "pending_approval" && caps.decide ? (
        <>
          <ActionButton action={() => approveInvoiceAction(invoice.id)}><CheckCircle2 /> {t("approve")}</ActionButton>
          <ConfirmDialog title={t("reject_title")} description={t("reject_reason")} requireReason action={(reason) => rejectInvoiceAction(invoice.id, reason)} trigger={<Button variant="outline"><XCircle /> {t("reject")}</Button>} onSuccess={() => router.refresh()} />
        </>
      ) : null}
      {s === "approved" && caps.sign ? (
        <span className="inline-flex items-center gap-1">
          <Select value={signer} onChange={(e) => setSigner(e.target.value)} className="w-40"><option value="">{t("signer")}</option>{signers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
          <ActionButton action={() => signInvoiceAction(invoice.id, signer || undefined)}><PenLine /> {signatureMode === "digital" ? t("sign") : t("issue")}</ActionButton>
        </span>
      ) : null}
      {s === "signed" && caps.send ? <SendDialog invoiceId={invoice.id} /> : null}
      {["approved", "signed", "sent", "partially_paid", "paid"].includes(s) && invoice.kind === "proforma" && caps.create ? <CreditDialog invoiceId={invoice.id} lines={lines} /> : null}
      {(s === "approved" || s === "signed" || s === "pending_approval") && caps.admin ? <ActionButton action={() => backToDraftAction(invoice.id)} variant="outline"><RotateCcw /> {t("back_to_draft")}</ActionButton> : null}
      {s !== "cancelled" && caps.cancel && !invoice.hasReceipts ? <ConfirmDialog title={t("cancel")} requireReason action={(reason) => cancelInvoiceAction(invoice.id, reason)} trigger={<Button variant="destructive"><XCircle /> {t("cancel")}</Button>} onSuccess={() => router.refresh()} /> : null}
    </div>
  );
}

function SendDialog({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("invoices.detail");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [to, setTo] = React.useState("");
  const [cc, setCc] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [pending, start] = React.useTransition();
  const load = () =>
    start(async () => {
      const d = await sendDefaultsAction(invoiceId);
      setTo(d.to.map((x) => x.email).join(", "));
      setCc(d.cc.join(", "));
      setSubject(d.subject);
      setBody(d.body);
    });
  const split = (s: string) => s.split(/[,\s;]+/).map((x) => x.trim()).filter(Boolean);
  return (
    <>
      <Button onClick={() => { setOpen(true); load(); }}><Send /> {t("send")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("send")}</DialogTitle></DialogHeader>
          <Field label={t("send_to")} htmlFor="send-to" required><Input id="send-to" value={to} onChange={(e) => setTo(e.target.value)} className="num" /></Field>
          <Field label={t("send_cc")} htmlFor="send-cc"><Input id="send-cc" value={cc} onChange={(e) => setCc(e.target.value)} className="num" /></Field>
          <Field label={t("send_subject")} htmlFor="send-subj" required><Input id="send-subj" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field label={t("send_body")} htmlFor="send-body" required hint={t("send_hint")}><Textarea id="send-body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={pending || !to.trim() || !subject.trim()} onClick={() => start(async () => {
              const res = await sendInvoiceAction({ invoiceId, to: split(to), cc: split(cc), subject, body });
              if (res.ok) { toast.success(tc("saved")); setOpen(false); router.refresh(); } else toast.error(tAll.has(res.error) ? tAll(res.error) : res.error);
            })}><Send /> {t("send")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreditDialog({ invoiceId, lines }: { invoiceId: string; lines: { id: string; description: string; amount: number; type: string }[] }) {
  const t = useTranslations("invoices.detail");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [sel, setSel] = React.useState<Record<string, number>>({});
  const [pending, start] = React.useTransition();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><FileMinus /> {t("credit")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("credit")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("credit_select")}</p>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {lines.filter((l) => l.amount !== 0).map((l) => (
              <label key={l.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 text-sm">
                <input type="checkbox" checked={l.id in sel} onChange={(e) => setSel((s) => { const n = { ...s }; if (e.target.checked) n[l.id] = 100; else delete n[l.id]; return n; })} />
                <span>{l.description}</span>
                <span className="num text-muted-foreground">{l.amount.toFixed(2)}</span>
                <Input type="number" min="0" max="100" step="0.001" value={sel[l.id] ?? ""} disabled={!(l.id in sel)} onChange={(e) => setSel((s) => ({ ...s, [l.id]: Number(e.target.value) }))} className="w-24" placeholder={t("credit_pct")} />
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={pending || Object.keys(sel).length === 0} onClick={() => start(async () => {
              const res = await createCreditInvoiceAction({ invoiceId, lines: Object.entries(sel).map(([lineId, pct]) => ({ lineId, pct })) });
              if (res.ok) { toast.success(tc("saved")); setOpen(false); router.push(`/invoices/${res.data.id}`); } else toast.error(tAll.has(res.error) ? tAll(res.error) : res.error);
            })}>{t("credit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
