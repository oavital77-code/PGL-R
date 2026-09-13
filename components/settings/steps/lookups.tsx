import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { contractStatuses, contractTypes, documentTypes, unitTypes } from "@/lib/db/schema";
import { LookupTable } from "../lookup-table";

export async function LookupsStep() {
  const [st, ty, un, dt, t] = await Promise.all([
    db.select().from(contractStatuses).orderBy(contractStatuses.sortOrder),
    db.select().from(contractTypes).orderBy(contractTypes.sortOrder),
    db.select().from(unitTypes).orderBy(unitTypes.sortOrder),
    db.select().from(documentTypes).orderBy(documentTypes.sortOrder),
    getTranslations("settings.lookups"),
  ]);
  const tc = await getTranslations("common");
  return (
    <div className="space-y-5">
      <LookupTable table="contract_statuses" rows={st} title={t("statuses")} addLabel={tc("add")} showCode showTerminal />
      <LookupTable table="contract_types" rows={ty} title={t("types")} addLabel={tc("add")} showCode />
      <LookupTable table="unit_types" rows={un} title={t("units")} addLabel={tc("add")} showCode />
      <LookupTable table="document_types" rows={dt} title={t("document_types")} addLabel={tc("add")} showCode />
    </div>
  );
}
