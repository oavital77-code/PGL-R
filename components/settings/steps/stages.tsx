import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { stageNames, stageTemplateItems, stageTemplates } from "@/lib/db/schema";
import { LookupTable } from "../lookup-table";
import { StageTemplatesEditor } from "../stage-templates-client";

export async function StagesStep() {
  const [names, templates, items, t] = await Promise.all([
    db.select().from(stageNames).orderBy(stageNames.sortOrder),
    db.select().from(stageTemplates).orderBy(stageTemplates.name),
    db.select().from(stageTemplateItems).orderBy(stageTemplateItems.sortOrder),
    getTranslations("settings.stages"),
  ]);
  return (
    <div className="space-y-5">
      <LookupTable table="stage_names" rows={names} title={t("names")} addLabel={t("add_name")} />
      <StageTemplatesEditor
        stageNames={names.filter((n) => n.isActive).map((n) => ({ id: n.id, name: n.name }))}
        templates={templates.map((tp) => ({
          id: tp.id,
          name: tp.name,
          isActive: tp.isActive,
          items: items.filter((i) => i.templateId === tp.id).map((i) => ({ stageNameId: i.stageNameId, defaultPct: Number(i.defaultPct) })),
        }))}
      />
    </div>
  );
}
