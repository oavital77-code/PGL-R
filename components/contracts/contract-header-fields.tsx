"use client";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { contracts } from "@/lib/db/schema";
import type { ContractFormLookups } from "@/lib/projects/lookups";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Contract = typeof contracts.$inferSelect;

/** Contract header fields (spec §8.2). Client defaults are only *suggested* (pre-fill) – spec §7.1. */
export function ContractHeaderFields({ contract, direction, lookups, defaultClientId, suppliers, statusCode, disabled }: { contract: Contract | null; direction: "income" | "expense"; lookups: ContractFormLookups; defaultClientId?: string; suppliers: { id: string; name: string }[]; statusCode?: string | null; disabled?: boolean }) {
  const t = useTranslations("contracts");
  const tc = useTranslations("common");
  const [clientId, setClientId] = React.useState(contract?.clientId ?? defaultClientId ?? "");
  const client = lookups.clients.find((c) => c.id === clientId);
  const [indexLinked, setIndexLinked] = React.useState<boolean>(contract ? contract.indexLinked : (client?.indexLinkedDefault ?? false));
  const [manual, setManual] = React.useState(contract?.statusManual ?? false);
  const [signed, setSigned] = React.useState(contract?.signedDate ?? "");
  React.useEffect(() => {
    if (!contract && client && client.indexLinkedDefault !== null) setIndexLinked(client.indexLinkedDefault);
  }, [client, contract]);
  return (
    <fieldset disabled={disabled} className="grid gap-4 md:grid-cols-2">
      <Field label={t("name")} htmlFor="name" required className="md:col-span-2">
        <Input id="name" name="name" defaultValue={contract?.name ?? ""} required />
      </Field>
      {direction === "income" ? (
        <>
          <Field label={t("client")} htmlFor="clientId" required>
            <Select id="clientId" name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">{tc("select")}</option>
              {lookups.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("paying_client")} htmlFor="payingClientId">
            <Select id="payingClientId" name="payingClientId" defaultValue={contract?.payingClientId ?? ""}>
              <option value="">{t("same_as_client")}</option>
              {lookups.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </>
      ) : (
        <Field label={t("supplier")} htmlFor="supplierId" required>
          <Select id="supplierId" name="supplierId" defaultValue={contract?.supplierId ?? ""} required>
            <option value="">{tc("select")}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={t("order_number")} htmlFor="orderNumber">
        <Input id="orderNumber" name="orderNumber" defaultValue={contract?.orderNumber ?? ""} className="num" />
      </Field>
      <Field label={t("contract_type")} htmlFor="contractTypeId">
        <Select id="contractTypeId" name="contractTypeId" defaultValue={contract?.contractTypeId ?? ""}>
          <option value="">—</option>
          {lookups.contractTypes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("signed_date")} htmlFor="signedDate" hint={t("signed_date_hint")}>
        <Input
          id="signedDate"
          name="signedDate"
          type="date"
          value={signed}
          onChange={(e) => {
            setSigned(e.target.value);
          }}
        />
      </Field>
      <Field label={t("opening_date")} htmlFor="openingDate">
        <Input id="openingDate" name="openingDate" type="date" defaultValue={contract?.openingDate ?? new Date().toISOString().slice(0, 10)} />
      </Field>
      <Field label={t("target_date")} htmlFor="targetDate">
        <Input id="targetDate" name="targetDate" type="date" defaultValue={contract?.targetDate ?? ""} />
      </Field>
      {contract ? (
        <Field label={t("actual_end_date")} htmlFor="actualEndDate">
          <Input id="actualEndDate" name="actualEndDate" type="date" defaultValue={contract?.actualEndDate ?? ""} />
        </Field>
      ) : null}
      {direction === "expense" ? (
        <Field label={t("budget_amount")} htmlFor="budgetAmount" hint={t("budget_amount_hint")}>
          <Input id="budgetAmount" name="budgetAmount" type="number" step="0.01" min="0" defaultValue={contract?.budgetAmount ?? ""} />
        </Field>
      ) : (
        <Field label={t("retention_pct")} htmlFor="retentionPct">
          <Input id="retentionPct" name="retentionPct" type="number" step="0.01" min="0" max="100" defaultValue={contract?.retentionPct ?? ""} />
        </Field>
      )}
      <div className="space-y-2 md:col-span-2 rounded-md border border-border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="indexLinked" checked={indexLinked} onChange={(e) => setIndexLinked(e.target.checked)} /> {t("index_linked")}
          {!contract && client?.indexLinkedDefault !== null && client?.indexLinkedDefault !== undefined ? <span className="text-xs text-muted-foreground">({t("suggested_from_client")})</span> : null}
        </label>
        {indexLinked ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("index_base_month")} htmlFor="indexBaseMonth" required hint={t("index_base_month_hint")}>
              <Input id="indexBaseMonth" name="indexBaseMonth" type="date" defaultValue={contract?.indexBaseMonth ?? (signed ? `${signed.slice(0, 7)}-01` : "")} required />
            </Field>
            <label className="flex items-center gap-2 text-sm pt-6">
              <input type="checkbox" name="indexFloor" defaultChecked={contract?.indexFloor ?? false} /> {t("index_floor")}
            </label>
          </div>
        ) : null}
      </div>
      {direction === "income" ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="participatesInHours" defaultChecked={contract?.participatesInHours ?? true} /> {t("participates_in_hours")}
        </label>
      ) : null}
      {contract ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="statusManual" checked={manual} onChange={(e) => setManual(e.target.checked)} /> {t("status_manual")}
          </label>
          {manual ? (
            <Select name="statusCode" defaultValue={statusCode ?? "active"}>
              {lookups.statuses.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      ) : null}
      <Field label={tc("description")} htmlFor="description" className="md:col-span-2">
        <Textarea id="description" name="description" defaultValue={contract?.description ?? ""} rows={2} />
      </Field>
      <Field label={tc("notes")} htmlFor="notes" className="md:col-span-2">
        <Textarea id="notes" name="notes" defaultValue={contract?.notes ?? ""} rows={2} />
      </Field>
    </fieldset>
  );
}
