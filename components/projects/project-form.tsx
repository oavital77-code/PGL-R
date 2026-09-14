"use client";
import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { upsertProjectAction } from "@/lib/projects/actions";
import type { projects } from "@/lib/db/schema";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface ProjectFormLookups {
  clients: { id: string; name: string }[];
  users: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  statuses: { code: string; name: string }[];
  workNumberMode: "manual" | "auto";
}

type Project = typeof projects.$inferSelect;

export function ProjectForm({ project, lookups, statusCode, onDone }: { project: Project | null; lookups: ProjectFormLookups; statusCode?: string | null; onDone?: () => void }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const router = useRouter();
  const [manual, setManual] = React.useState(project?.statusManual ?? false);
  return (
    <ActionForm
      action={upsertProjectAction}
      onSuccess={(d) => {
        onDone?.();
        if (!project) router.push(`/projects/${d.id}`);
      }}
    >
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("work_number")} htmlFor="workNumber" required={lookups.workNumberMode === "manual" && !project} hint={lookups.workNumberMode === "auto" && !project ? t("work_number_auto") : undefined}>
          <Input id="workNumber" name="workNumber" defaultValue={project?.workNumber ?? ""} className="num" required={lookups.workNumberMode === "manual" && !project} />
        </Field>
        <Field label={t("name")} htmlFor="name" required>
          <Input id="name" name="name" defaultValue={project?.name ?? ""} required />
        </Field>
        <Field label={t("client")} htmlFor="clientId" required>
          <Select id="clientId" name="clientId" defaultValue={project?.clientId ?? ""} required>
            <option value="">{tc("select")}</option>
            {lookups.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("paying_client")} htmlFor="payingClientId" hint={t("paying_client_hint")}>
          <Select id="payingClientId" name="payingClientId" defaultValue={project?.payingClientId ?? ""}>
            <option value="">{t("same_as_client")}</option>
            {lookups.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("project_manager")} htmlFor="projectManagerUserId">
          <Select id="projectManagerUserId" name="projectManagerUserId" defaultValue={project?.projectManagerUserId ?? ""}>
            <option value="">—</option>
            {lookups.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("department")} htmlFor="departmentId">
          <Select id="departmentId" name="departmentId" defaultValue={project?.departmentId ?? ""}>
            <option value="">—</option>
            {lookups.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("start_date")} htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" defaultValue={project?.startDate ?? ""} />
        </Field>
        <Field label={t("target_date")} htmlFor="targetDate">
          <Input id="targetDate" name="targetDate" type="date" defaultValue={project?.targetDate ?? ""} />
        </Field>
        <Field label={t("actual_end_date")} htmlFor="actualEndDate">
          <Input id="actualEndDate" name="actualEndDate" type="date" defaultValue={project?.actualEndDate ?? ""} />
        </Field>
        {project ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm pt-6">
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
      </div>
      <Field label={tc("description")} htmlFor="description">
        <Textarea id="description" name="description" defaultValue={project?.description ?? ""} rows={2} />
      </Field>
      <Field label={tc("notes")} htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={project?.notes ?? ""} rows={2} />
      </Field>
    </ActionForm>
  );
}

export function ProjectDialog({ project, lookups, statusCode }: { project: Project | null; lookups: ProjectFormLookups; statusCode?: string | null }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant={project ? "outline" : "default"}>
        {project ? <Pencil /> : <Plus />} {project ? tc("edit") : t("new")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{project ? tc("edit") : t("new")}</DialogTitle>
          </DialogHeader>
          <ProjectForm project={project} lookups={lookups} statusCode={statusCode} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
