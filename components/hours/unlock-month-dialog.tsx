"use client";
import { LockOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { unlockPeriodAction } from "@/lib/hours/actions";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function UnlockMonthDialog({ userId, month }: { userId: string; month: string }) {
  const t = useTranslations("hours");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <LockOpen /> {t("unlock_month")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("unlock_month")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={unlockPeriodAction} onSuccess={() => setOpen(false)}>
            <input type="hidden" name="userId" value={userId} />
            <Field label={t("month")} htmlFor="ul-month" required>
              <Input id="ul-month" name="month" type="date" defaultValue={month} required />
            </Field>
            <Field label={t("unlock_days")} htmlFor="ul-days" required>
              <Input id="ul-days" name="days" type="number" min="1" max="60" defaultValue={7} required />
            </Field>
            <Field label={t("reason")} htmlFor="ul-reason" required>
              <Textarea id="ul-reason" name="reason" rows={2} required minLength={2} />
            </Field>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
