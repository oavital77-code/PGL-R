"use client";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserForm } from "./user-form";

export function InviteUserDialog({ departments, grades }: { departments: { id: string; name: string }[]; grades: { id: string; name: string }[] }) {
  const t = useTranslations("users");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> {t("invite")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("invite")}</DialogTitle>
          </DialogHeader>
          <UserForm user={null} departments={departments} grades={grades} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
