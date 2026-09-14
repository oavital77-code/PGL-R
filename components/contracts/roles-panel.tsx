"use client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { deleteContractRoleAction, upsertContractRoleAction } from "@/lib/contracts/actions";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface RoleRow {
  id: string;
  roleTitle: string;
  userId: string | null;
  contactId: string | null;
  freeName: string | null;
  notes: string | null;
  display: string;
}

export function RolesPanel({ contractId, rows, users, contacts, roleTitles, canEdit }: { contractId: string; rows: RoleRow[]; users: { id: string; name: string }[]; contacts: { id: string; name: string }[]; roleTitles: string[]; canEdit: boolean }) {
  const t = useTranslations("roles_panel");
  const tc = useTranslations("common");
  const [editing, setEditing] = React.useState<RoleRow | null | "new">(null);
  const [kind, setKind] = React.useState<"user" | "contact" | "free">("user");
  const row = editing === "new" ? null : editing;
  React.useEffect(() => {
    if (row) setKind(row.userId ? "user" : row.contactId ? "contact" : "free");
    else setKind("user");
  }, [row]);
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
            <TableHead>{t("role")}</TableHead>
            <TableHead>{tc("name")}</TableHead>
            <TableHead>{tc("notes")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                {tc("none")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.roleTitle}</TableCell>
                <TableCell>{r.display}</TableCell>
                <TableCell>{r.notes ?? "—"}</TableCell>
                <TableCell className="text-end whitespace-nowrap">
                  {canEdit ? (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ActionButton action={() => deleteContractRoleAction(r.id)} variant="ghost" size="icon" confirm={tc("confirm_delete")}>
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
          <ActionForm action={upsertContractRoleAction} onSuccess={() => setEditing(null)}>
            {row ? <input type="hidden" name="id" value={row.id} /> : null}
            <input type="hidden" name="contractId" value={contractId} />
            <Field label={t("role")} htmlFor="r-title" required>
              <Input id="r-title" name="roleTitle" list="role-titles" defaultValue={row?.roleTitle ?? ""} required />
              <datalist id="role-titles">
                {roleTitles.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </Field>
            <Field label={t("kind")} htmlFor="r-kind">
              <Select id="r-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                <option value="user">{t("kind_user")}</option>
                <option value="contact">{t("kind_contact")}</option>
                <option value="free">{t("kind_free")}</option>
              </Select>
            </Field>
            {kind === "user" ? (
              <Field label={t("kind_user")} htmlFor="r-user">
                <Select id="r-user" name="userId" defaultValue={row?.userId ?? ""}>
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : kind === "contact" ? (
              <Field label={t("kind_contact")} htmlFor="r-contact">
                <Select id="r-contact" name="contactId" defaultValue={row?.contactId ?? ""}>
                  <option value="">—</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label={t("kind_free")} htmlFor="r-free">
                <Input id="r-free" name="freeName" defaultValue={row?.freeName ?? ""} />
              </Field>
            )}
            <Field label={tc("notes")} htmlFor="r-notes">
              <Input id="r-notes" name="notes" defaultValue={row?.notes ?? ""} />
            </Field>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
