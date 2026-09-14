"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { upsertClientAction } from "@/lib/clients/actions";
import type { clients } from "@/lib/db/schema";
import { ActionForm } from "@/components/shared/action-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Client = typeof clients.$inferSelect;

export function ClientForm({ client, onDone }: { client: Client | null; onDone?: () => void }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const router = useRouter();
  return (
    <ActionForm
      action={upsertClientAction}
      onSuccess={(d) => {
        for (const w of d.warnings) toast.warning(tAll(w));
        onDone?.();
        if (!client) router.push(`/clients/${d.id}`);
      }}
    >
      {client ? <input type="hidden" name="id" value={client.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("name")} htmlFor="name" required>
          <Input id="name" name="name" defaultValue={client?.name ?? ""} required />
        </Field>
        <Field label={t("tax_id")} htmlFor="taxId" hint={t("tax_id_hint")}>
          <Input id="taxId" name="taxId" defaultValue={client?.taxId ?? ""} className="num" />
        </Field>
        <Field label={t("kind")} htmlFor="clientKind">
          <Select id="clientKind" name="clientKind" defaultValue={client?.clientKind ?? "company"}>
            <option value="company">{t("kind_company")}</option>
            <option value="authority">{t("kind_authority")}</option>
            <option value="private">{t("kind_private")}</option>
            <option value="other">{t("kind_other")}</option>
          </Select>
        </Field>
        <Field label={t("payment_terms_days")} htmlFor="paymentTermsDays" hint={t("payment_terms_hint")}>
          <Input id="paymentTermsDays" name="paymentTermsDays" type="number" min="0" defaultValue={client?.paymentTermsDays ?? ""} />
        </Field>
        <Field label={t("address_street")} htmlFor="addressStreet">
          <Input id="addressStreet" name="addressStreet" defaultValue={client?.addressStreet ?? ""} />
        </Field>
        <Field label={t("address_city")} htmlFor="addressCity">
          <Input id="addressCity" name="addressCity" defaultValue={client?.addressCity ?? ""} />
        </Field>
        <Field label={t("address_zip")} htmlFor="addressZip">
          <Input id="addressZip" name="addressZip" defaultValue={client?.addressZip ?? ""} className="num" />
        </Field>
        <Field label={tc("phone")} htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={client?.phone ?? ""} />
        </Field>
        <Field label={tc("email")} htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} />
        </Field>
        <Field label={t("website")} htmlFor="website">
          <Input id="website" name="website" defaultValue={client?.website ?? ""} className="num" />
        </Field>
        <Field label={t("index_linked_default")} htmlFor="indexLinkedDefault">
          <Select id="indexLinkedDefault" name="indexLinkedDefault" defaultValue={client?.indexLinkedDefault === null || client?.indexLinkedDefault === undefined ? "" : String(client.indexLinkedDefault)}>
            <option value="">{t("no_default")}</option>
            <option value="true">{tc("yes")}</option>
            <option value="false">{tc("no")}</option>
          </Select>
        </Field>
        <Field label={t("withholding_tax_pct")} htmlFor="withholdingTaxPct">
          <Input id="withholdingTaxPct" name="withholdingTaxPct" type="number" step="0.01" min="0" max="100" defaultValue={client?.withholdingTaxPct ?? ""} />
        </Field>
        <Field label={t("withholding_valid_until")} htmlFor="withholdingValidUntil">
          <Input id="withholdingValidUntil" name="withholdingValidUntil" type="date" defaultValue={client?.withholdingValidUntil ?? ""} />
        </Field>
        <div className="flex flex-col gap-2 pt-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="vatExempt" defaultChecked={client?.vatExempt ?? false} /> {t("vat_exempt")}
          </label>
          {client ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={client.isActive} /> {tc("active")}
            </label>
          ) : null}
        </div>
      </div>
      <Field label={tc("notes")} htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ""} rows={2} />
      </Field>
    </ActionForm>
  );
}
