"use client";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { duplicateProjectAction } from "@/lib/projects/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function DuplicateProjectDialog({ projectId, defaultName }: { projectId: string; defaultName: string }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [wn, setWn] = React.useState("");
  const [name, setName] = React.useState(defaultName);
  const [pending, start] = React.useTransition();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Copy /> {tc("duplicate")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("duplicate_title")}</DialogTitle>
          </DialogHeader>
          <Field label={t("work_number")} htmlFor="dup-wn" required>
            <Input id="dup-wn" value={wn} onChange={(e) => setWn(e.target.value)} className="num" />
          </Field>
          <Field label={t("name")} htmlFor="dup-name" required>
            <Input id="dup-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={pending || !wn.trim()}
              onClick={() =>
                start(async () => {
                  const res = await duplicateProjectAction(projectId, wn, name);
                  if (res.ok) {
                    toast.success(tc("saved"));
                    setOpen(false);
                    router.push(`/projects/${res.data.id}`);
                  } else toast.error(tAll.has(res.error) ? tAll(res.error) : res.error);
                })
              }
            >
              {tc("duplicate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
