"use client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { deleteContactAction, upsertContactAction } from "@/lib/clients/actions";
import type { contacts } from "@/lib/db/schema";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Contact = typeof contacts.$inferSelect;

export function ContactsPanel({ owner, rows, canEdit, showInvoiceFlag = true }: { owner: { clientId?: string; supplierId?: string }; rows: Contact[]; canEdit: boolean; showInvoiceFlag?: boolean }) {
  const t = useTranslations("contacts");
  const tc = useTranslations("common");
  const [editing, setEditing] = React.useState<Contact | null | "new">(null);
  const row = editing === "new" ? null : editing;
  return (
    <div className="space-y-3">
      {canEdit ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> {t("add")}
          </Button>
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tc("name")}</TableHead>
            <TableHead>{t("role_title")}</TableHead>
            <TableHead>{tc("email")}</TableHead>
            <TableHead>{tc("phone")}</TableHead>
            {showInvoiceFlag ? <TableHead>{t("receives_invoices")}</TableHead> : null}
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  {c.firstName} {c.lastName} {c.isPrimary ? <Badge variant="secondary">{t("primary")}</Badge> : null}
                </TableCell>
                <TableCell>{c.roleTitle ?? "—"}</TableCell>
                <TableCell className="num-cell">{c.email ?? "—"}</TableCell>
                <TableCell className="num-cell">{c.phone ?? "—"}</TableCell>
                {showInvoiceFlag ? <TableCell>{c.receivesInvoices ? "✔" : ""}</TableCell> : null}
                <TableCell className="text-end whitespace-nowrap">
                  {canEdit ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ActionButton action={() => deleteContactAction(c.id)} variant="ghost" size="icon" confirm={tc("confirm_delete")}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </ActionButton>
                    </>
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{row ? tc("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={upsertContactAction} onSuccess={() => setEditing(null)}>
            {row ? <input type="hidden" name="id" value={row.id} /> : null}
            {owner.clientId ? <input type="hidden" name="clientId" value={owner.clientId} /> : null}
            {owner.supplierId ? <input type="hidden" name="supplierId" value={owner.supplierId} /> : null}
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("first_name")} htmlFor="c-first" required>
                <Input id="c-first" name="firstName" defaultValue={row?.firstName ?? ""} required />
              </Field>
              <Field label={t("last_name")} htmlFor="c-last">
                <Input id="c-last" name="lastName" defaultValue={row?.lastName ?? ""} />
              </Field>
              <Field label={t("role_title")} htmlFor="c-role">
                <Input id="c-role" name="roleTitle" defaultValue={row?.roleTitle ?? ""} />
              </Field>
              <Field label={tc("email")} htmlFor="c-email">
                <Input id="c-email" name="email" type="email" defaultValue={row?.email ?? ""} />
              </Field>
              <Field label={tc("phone")} htmlFor="c-phone">
                <Input id="c-phone" name="phone" type="tel" defaultValue={row?.phone ?? ""} />
              </Field>
            </div>
            {showInvoiceFlag ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="receivesInvoices" defaultChecked={row?.receivesInvoices ?? false} /> {t("receives_invoices")}
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPrimary" defaultChecked={row?.isPrimary ?? false} /> {t("primary")}
            </label>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
