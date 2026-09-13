"use client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { toggleStageTemplateAction, upsertStageTemplateAction } from "@/lib/lookups/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";

interface Template {
  id: string;
  name: string;
  isActive: boolean;
  items: { stageNameId: string; defaultPct: number }[];
}

export function StageTemplatesEditor({ stageNames, templates }: { stageNames: { id: string; name: string }[]; templates: Template[] }) {
  const t = useTranslations("settings.stages");
  const tc = useTranslations("common");
  const router = useRouter();
  const [editing, setEditing] = React.useState<Template | null>(null);
  const [pending, start] = React.useTransition();
  const nameOf = (id: string) => stageNames.find((s) => s.id === id)?.name ?? "?";

  const openNew = () => setEditing({ id: "", name: "", isActive: true, items: [{ stageNameId: stageNames[0]?.id ?? "", defaultPct: 0 }] });
  const sum = editing ? editing.items.reduce((a, i) => a + (Number(i.defaultPct) || 0), 0) : 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-semibold">{t("templates")}</h3>
        <Button size="sm" onClick={openNew}>
          <Plus /> {t("add_template")}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tc("name")}</TableHead>
            <TableHead>{t("template_items")}</TableHead>
            <TableHead>{t("sum")}</TableHead>
            <TableHead>{tc("active")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((tp) => {
            const s = tp.items.reduce((a, i) => a + i.defaultPct, 0);
            return (
              <TableRow key={tp.id} className={tp.isActive ? "" : "opacity-60"}>
                <TableCell className="font-medium">{tp.name}</TableCell>
                <TableCell className="text-xs">{tp.items.map((i) => `${nameOf(i.stageNameId)} ${i.defaultPct}%`).join(" | ")}</TableCell>
                <TableCell className={cn("num", Math.abs(s - 100) < 0.001 ? "text-success" : "text-warning")}>{s}%</TableCell>
                <TableCell>
                  <Switch checked={tp.isActive} onCheckedChange={(v) => toggleStageTemplateAction(tp.id, v).then(() => router.refresh())} />
                </TableCell>
                <TableCell className="text-end">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(tp)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? tc("edit") : t("add_template")}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <Field label={tc("name")} htmlFor="tpl-name" required>
                <Input id="tpl-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("stage")}</TableHead>
                    <TableHead>{t("default_pct")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editing.items.map((it, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="num">{idx + 1}</TableCell>
                      <TableCell>
                        <Select value={it.stageNameId} onChange={(e) => setEditing({ ...editing, items: editing.items.map((x, i) => (i === idx ? { ...x, stageNameId: e.target.value } : x)) })}>
                          {stageNames.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.001" min="0" max="100" value={it.defaultPct} onChange={(e) => setEditing({ ...editing, items: editing.items.map((x, i) => (i === idx ? { ...x, defaultPct: Number(e.target.value) } : x)) })} className="w-28" />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setEditing({ ...editing, items: editing.items.filter((_, i) => i !== idx) })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setEditing({ ...editing, items: [...editing.items, { stageNameId: stageNames[0]?.id ?? "", defaultPct: 0 }] })}>
                  <Plus /> {t("add_item")}
                </Button>
                <span className={cn("text-sm num", Math.abs(sum - 100) < 0.001 ? "text-success" : "text-warning")}>
                  {t("sum")}: {sum}%
                </span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  {tc("cancel")}
                </Button>
                <Button
                  disabled={pending || !editing.name.trim() || editing.items.length === 0}
                  onClick={() =>
                    start(async () => {
                      const res = await upsertStageTemplateAction({ id: editing.id || undefined, name: editing.name, items: editing.items });
                      if (res.ok) {
                        toast.success(tc("saved"));
                        setEditing(null);
                        router.refresh();
                      } else toast.error(res.error);
                    })
                  }
                >
                  {tc("save")}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
