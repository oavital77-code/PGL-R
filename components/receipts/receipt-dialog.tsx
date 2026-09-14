"use client";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { upsertReceiptAction } from "@/lib/receipts/actions";
import type { receipts } from "@/lib/db/schema";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ReceiptDialog({ receipt, clients }: { receipt: typeof receipts.$inferSelect | null; clients: { id: string; name: string }[] }) {
  const t = useTranslations("receipts");
  const tc = useTranslations("common");
  const tm = useTranslations("receipts.methods");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size={receipt ? "icon" : "default"} variant={receipt ? "ghost" : "default"} onClick={() => setOpen(true)} aria-label={receipt ? tc("edit") : t("new")}>
        {receipt ? <Pencil className="h-4 w-4" /> : <><Plus /> {t("new")}</>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{receipt ? tc("edit") : t("new")}</DialogTitle></DialogHeader>
          <ActionForm action={upsertReceiptAction} onSuccess={() => setOpen(false)}>
            {receipt ? <input type="hidden" name="id" value={receipt.id} /> : null}
            <Field label={t("client")} htmlFor="rc-client" required>
              <Select id="rc-client" name="clientId" defaultValue={receipt?.clientId ?? ""} required><option value="">{tc("select")}</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("date")} htmlFor="rc-date" required><Input id="rc-date" name="receiptDate" type="date" defaultValue={receipt?.receiptDate ?? new Date().toISOString().slice(0, 10)} required /></Field>
              <Field label={t("amount")} htmlFor="rc-amount" required><Input id="rc-amount" name="amount" type="number" step="0.01" min="0.01" defaultValue={receipt?.amount ?? ""} required /></Field>
              <Field label={t("method")} htmlFor="rc-method"><Select id="rc-method" name="method" defaultValue={receipt?.method ?? "transfer"}>{(["transfer", "check", "credit_card", "cash", "other"] as const).map((m) => <option key={m} value={m}>{tm(m)}</option>)}</Select></Field>
              <Field label={t("reference")} htmlFor="rc-ref"><Input id="rc-ref" name="reference" defaultValue={receipt?.reference ?? ""} className="num" /></Field>
            </div>
            <Field label={tc("notes")} htmlFor="rc-notes"><Textarea id="rc-notes" name="notes" defaultValue={receipt?.notes ?? ""} rows={2} /></Field>
            <Field label={t("file")} htmlFor="rc-file"><Input id="rc-file" name="file" type="file" /></Field>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
