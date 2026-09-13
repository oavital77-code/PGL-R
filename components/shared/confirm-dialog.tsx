"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/result";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props<T> extends Omit<ButtonProps, "onClick"> {
  title: string;
  description?: string;
  /** when true a reason textarea is required and passed to the action (spec §16.8) */
  requireReason?: boolean;
  action: (reason: string) => Promise<ActionResult<T>>;
  onSuccess?: (data: T) => void;
  successMessage?: string;
  trigger: React.ReactNode;
}

export function ConfirmDialog<T>({ title, description, requireReason, action, onSuccess, successMessage, trigger, ...btn }: Props<T>) {
  const t = useTranslations("common");
  const tAll = useTranslations();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, start] = React.useTransition();
  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex">
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {requireReason ? (
            <div className="space-y-1.5">
              <Label htmlFor="reason">{t("reason")}</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button
              {...btn}
              disabled={pending || (requireReason && reason.trim().length < 2)}
              onClick={() =>
                start(async () => {
                  const res = await action(reason.trim());
                  if (res.ok) {
                    toast.success(successMessage ?? t("saved"));
                    setOpen(false);
                    setReason("");
                    onSuccess?.(res.data);
                    router.refresh();
                  } else toast.error(tAll.has(res.error) ? tAll(res.error) : res.error);
                })
              }
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
