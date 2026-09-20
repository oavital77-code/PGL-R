"use client";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { removeTimeEntryFromDraftAction } from "@/lib/invoices/actions";
import { formatDate, formatHours } from "@/lib/i18n/format";
import { ActionButton } from "@/components/shared/action-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function TimeEntriesPanel({ invoiceId, editable, rows }: { invoiceId: string; editable: boolean; rows: { id: string; date: string; name: string; sub: string; minutes: number; description: string }[] }) {
  const t = useTranslations("invoices.detail");
  return (
    <div className="space-y-2">
      {editable ? <p className="text-xs text-muted-foreground">{t("entries_hint")}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{useTranslations("common")("date")}</TableHead>
            <TableHead>{useTranslations("hours")("sub_contract")}</TableHead>
            <TableHead>{useTranslations("dashboard")("employee")}</TableHead>
            <TableHead>{t("hours")}</TableHead>
            <TableHead>{useTranslations("common")("description")}</TableHead>
            {editable ? <TableHead /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="num-cell">{formatDate(r.date)}</TableCell>
              <TableCell>{r.sub}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell className="num-cell">{formatHours(r.minutes)}</TableCell>
              <TableCell>{r.description}</TableCell>
              {editable ? <TableCell><ActionButton action={() => removeTimeEntryFromDraftAction(invoiceId, r.id)} variant="ghost" size="icon" aria-label={t("remove_entry")}><Trash2 className="h-4 w-4 text-destructive" /></ActionButton></TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
