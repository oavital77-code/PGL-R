"use client";
import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { upsertSupplierAction } from "@/lib/suppliers/actions";
import type { suppliers } from "@/lib/db/schema";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Supplier = typeof suppliers.$inferSelect;

export function SupplierForm({ supplier, fields, onDone }: { supplier: Supplier | null; fields: string[]; onDone?: () => void }) {
  const t = useTranslations("suppliers");
  const tc = useTranslations("common");
  const router = useRouter();
  return (
    <ActionForm
      action={upsertSupplierAction}
      onSuccess={(d) => {
        onDone?.();
        if (!supplier) router.push(`/suppliers/${d.id}`);
      }}
    >
      {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("name")} htmlFor="name" required>
          <Input id="name" name="name" defaultValue={supplier?.name ?? ""} required />
        </Field>
        <Field label={t("tax_id")} htmlFor="taxId">
          <Input id="taxId" name="taxId" defaultValue={supplier?.taxId ?? ""} className="num" />
        </Field>
        <Field label={t("field")} htmlFor="field">
          <Input id="field" name="field" list="supplier-fields" defaultValue={supplier?.field ?? ""} />
          <datalist id="supplier-fields">
            {fields.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Field>
        <Field label={t("payment_terms_days")} htmlFor="paymentTermsDays">
          <Input id="paymentTermsDays" name="paymentTermsDays" type="number" min="0" defaultValue={supplier?.paymentTermsDays ?? ""} />
        </Field>
        <Field label={t("address_street")} htmlFor="addressStreet">
          <Input id="addressStreet" name="addressStreet" defaultValue={supplier?.addressStreet ?? ""} />
        </Field>
        <Field label={t("address_city")} htmlFor="addressCity">
          <Input id="addressCity" name="addressCity" defaultValue={supplier?.addressCity ?? ""} />
        </Field>
        <Field label={tc("phone")} htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={supplier?.phone ?? ""} />
        </Field>
        <Field label={tc("email")} htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={supplier?.email ?? ""} />
        </Field>
        <Field label={t("website")} htmlFor="website">
          <Input id="website" name="website" defaultValue={supplier?.website ?? ""} className="num" />
        </Field>
        {supplier ? (
          <label className="flex items-center gap-2 text-sm pt-6">
            <input type="checkbox" name="isActive" defaultChecked={supplier.isActive} /> {tc("active")}
          </label>
        ) : null}
      </div>
      <Field label={tc("notes")} htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={supplier?.notes ?? ""} rows={2} />
      </Field>
    </ActionForm>
  );
}

export function SupplierDialog({ supplier, fields }: { supplier: Supplier | null; fields: string[] }) {
  const t = useTranslations("suppliers");
  const tc = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant={supplier ? "outline" : "default"}>
        {supplier ? <Pencil /> : <Plus />} {supplier ? tc("edit") : t("new")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{supplier ? tc("edit") : t("new")}</DialogTitle>
          </DialogHeader>
          <SupplierForm supplier={supplier} fields={fields} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
