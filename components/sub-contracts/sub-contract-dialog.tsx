"use client";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { createSubContractAction, deleteSubContractAction, duplicateSubContractAction, updateSubContractAction } from "@/lib/sub-contracts/actions";
import type { subContracts } from "@/lib/db/schema";
import type { ContractFormLookups } from "@/lib/projects/lookups";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PricingFields } from "@/components/contracts/pricing-fields";

type SC = typeof subContracts.$inferSelect;

export function SubContractForm({ contractId, sc, lookups, isSupplier, statusCode, onDone }: { contractId: string; sc: SC | null; lookups: ContractFormLookups; isSupplier: boolean; statusCode?: string | null; onDone?: () => void }) {
  const t = useTranslations("sub_contracts");
  const tc = useTranslations("common");
  const router = useRouter();
  const [linked, setLinked] = React.useState(sc?.indexLinked ?? false);
  return (
    <ActionForm
      action={sc ? updateSubContractAction : createSubContractAction}
      onSuccess={(d) => {
        onDone?.();
        if (!sc) router.push(`/sub-contracts/${d.id}`);
      }}
    >
      {sc ? <input type="hidden" name="id" value={sc.id} /> : null}
      <input type="hidden" name="contractId" value={contractId} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("name")} htmlFor="sc-name" required className="md:col-span-2">
          <Input id="sc-name" name="name" defaultValue={sc?.name ?? ""} required />
        </Field>
        <Field label={t("opening_date")} htmlFor="sc-open">
          <Input id="sc-open" name="openingDate" type="date" defaultValue={sc?.openingDate ?? new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label={t("department")} htmlFor="sc-dept" hint={t("department_hint")}>
          <Select id="sc-dept" name="departmentId" defaultValue={sc?.departmentId ?? ""}>
            <option value="">{t("inherit")}</option>
            {lookups.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        {sc ? (
          <Field label={tc("status")} htmlFor="sc-status">
            <Select id="sc-status" name="statusCode" defaultValue={statusCode ?? ""}>
              <option value="">—</option>
              {lookups.statuses.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <div className="space-y-2 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="indexLinked" checked={linked} onChange={(e) => setLinked(e.target.checked)} /> {t("index_linked")}
          </label>
          {linked ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("index_base_month")} htmlFor="sc-ibm" hint={t("index_base_month_hint")}>
                <Input id="sc-ibm" name="indexBaseMonth" type="date" defaultValue={sc?.indexBaseMonth ?? ""} />
              </Field>
              <label className="flex items-center gap-2 text-sm pt-6">
                <input type="checkbox" name="indexFloor" defaultChecked={sc?.indexFloor ?? false} /> {t("index_floor")}
              </label>
            </div>
          ) : null}
          {!isSupplier ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="participatesInHours" defaultChecked={sc?.participatesInHours ?? true} /> {t("participates_in_hours")}
            </label>
          ) : null}
        </div>
      </div>
      <PricingFields sc={sc} unitTypes={lookups.unitTypes} templates={lookups.templates} showTemplate={!sc} />
      <Field label={tc("notes")} htmlFor="sc-notes">
        <Textarea id="sc-notes" name="notes" defaultValue={sc?.notes ?? ""} rows={2} />
      </Field>
    </ActionForm>
  );
}

export function SubContractDialog({ contractId, subContractId, sc, lookups, label, isSupplier, statusCode, variant }: { contractId: string; subContractId?: string; sc?: SC | null; lookups: ContractFormLookups; label: string; isSupplier: boolean; statusCode?: string | null; variant?: "default" | "outline" | "ghost" }) {
  const [open, setOpen] = React.useState(false);
  const editing = Boolean(subContractId || sc);
  return (
    <>
      <Button size="sm" variant={variant ?? (editing ? "outline" : "default")} onClick={() => setOpen(true)}>
        {editing ? <Pencil /> : <Plus />} {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          {open ? <SubContractLoader contractId={contractId} subContractId={subContractId} sc={sc ?? null} lookups={lookups} isSupplier={isSupplier} statusCode={statusCode} onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** When only an id is given (contract page), the row is fetched lazily via a server action. */
function SubContractLoader({ contractId, subContractId, sc, lookups, isSupplier, statusCode, onDone }: { contractId: string; subContractId?: string; sc: SC | null; lookups: ContractFormLookups; isSupplier: boolean; statusCode?: string | null; onDone: () => void }) {
  const [row, setRow] = React.useState<SC | null>(sc);
  const [loading, setLoading] = React.useState(Boolean(subContractId && !sc));
  React.useEffect(() => {
    if (!subContractId || sc) return;
    import("@/lib/sub-contracts/queries-actions").then(({ getSubContractAction }) =>
      getSubContractAction(subContractId).then((r) => {
        setRow(r);
        setLoading(false);
      }),
    );
  }, [subContractId, sc]);
  if (loading) return <div className="p-6 text-sm text-muted-foreground">…</div>;
  return <SubContractForm contractId={contractId} sc={row} lookups={lookups} isSupplier={isSupplier} statusCode={statusCode} onDone={onDone} />;
}

export function SubContractRowActions({ contractId, subContractId, lookups, isSupplier, isLocked }: { contractId: string; subContractId: string; lookups: ContractFormLookups; isSupplier: boolean; isLocked: boolean }) {
  const tc = useTranslations("common");
  const router = useRouter();
  return (
    <span className="inline-flex items-center gap-1">
      {!isLocked ? <SubContractDialog contractId={contractId} subContractId={subContractId} lookups={lookups} label={tc("edit")} isSupplier={isSupplier} variant="ghost" /> : null}
      <ActionButton action={() => duplicateSubContractAction(subContractId)} variant="ghost" size="icon" onSuccess={(d) => router.push(`/sub-contracts/${d.id}`)} aria-label={tc("duplicate")}>
        <Copy className="h-4 w-4" />
      </ActionButton>
      <ActionButton action={() => deleteSubContractAction(subContractId)} variant="ghost" size="icon" confirm={tc("confirm_delete")} aria-label={tc("delete")}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </ActionButton>
    </span>
  );
}
