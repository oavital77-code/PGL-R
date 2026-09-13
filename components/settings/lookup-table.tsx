"use client";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toggleLookupActiveAction, upsertLookupAction, type LookupTable as LookupTableName } from "@/lib/lookups/actions";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export interface LookupRow {
  id: string;
  name: string;
  code?: string | null;
  sortOrder: number;
  isActive: boolean;
  isTerminal?: boolean;
  managerUserId?: string | null;
}

interface Props {
  table: LookupTableName;
  rows: LookupRow[];
  title: string;
  addLabel: string;
  showCode?: boolean;
  showTerminal?: boolean;
  managers?: { id: string; name: string }[];
}

export function LookupTable({ table, rows, title, addLabel, showCode, showTerminal, managers }: Props) {
  const t = useTranslations("common");
  const tl = useTranslations("settings.lookups");
  const td = useTranslations("settings.departments");
  const [editing, setEditing] = React.useState<LookupRow | null | "new">(null);
  const row = editing === "new" ? null : editing;
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-semibold">{title}</h3>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus /> {addLabel}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">{t("sort_order")}</TableHead>
            <TableHead>{t("name")}</TableHead>
            {showCode ? <TableHead>{t("code")}</TableHead> : null}
            {showTerminal ? <TableHead>{tl("is_terminal")}</TableHead> : null}
            {managers ? <TableHead>{td("manager")}</TableHead> : null}
            <TableHead>{t("active")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={r.isActive ? "" : "opacity-60"}>
              <TableCell className="num">{r.sortOrder}</TableCell>
              <TableCell>{r.name}</TableCell>
              {showCode ? <TableCell className="num text-xs">{r.code}</TableCell> : null}
              {showTerminal ? <TableCell>{r.isTerminal ? <Badge variant="muted">{tl("is_terminal")}</Badge> : null}</TableCell> : null}
              {managers ? <TableCell>{managers.find((m) => m.id === r.managerUserId)?.name ?? "—"}</TableCell> : null}
              <TableCell>
                <Switch checked={r.isActive} onCheckedChange={(v) => toggleLookupActiveAction(table, r.id, v).then(() => window.location.reload())} />
              </TableCell>
              <TableCell className="text-end">
                <Button variant="ghost" size="icon" onClick={() => setEditing(r)} aria-label={t("edit")}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{row ? t("edit") : addLabel}</DialogTitle>
          </DialogHeader>
          <ActionForm action={(fd) => upsertLookupAction(table, fd)} onSuccess={() => setEditing(null)}>
            {row ? <input type="hidden" name="id" value={row.id} /> : null}
            <Field label={t("name")} htmlFor="lk-name" required>
              <Input id="lk-name" name="name" defaultValue={row?.name ?? ""} required />
            </Field>
            {showCode ? (
              <Field label={t("code")} htmlFor="lk-code">
                <Input id="lk-code" name="code" defaultValue={row?.code ?? ""} className="num" />
              </Field>
            ) : null}
            <Field label={t("sort_order")} htmlFor="lk-sort">
              <Input id="lk-sort" name="sortOrder" type="number" defaultValue={row?.sortOrder ?? rows.length + 1} />
            </Field>
            {managers ? (
              <Field label={td("manager")} htmlFor="lk-manager">
                <Select id="lk-manager" name="managerUserId" defaultValue={row?.managerUserId ?? ""}>
                  <option value="">—</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {showTerminal ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isTerminal" defaultChecked={row?.isTerminal ?? false} /> {tl("is_terminal")}
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={row?.isActive ?? true} /> {t("active")}
            </label>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
