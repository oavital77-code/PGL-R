"use client";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { clients } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientForm } from "./client-form";

export function ClientDialog({ client }: { client: typeof clients.$inferSelect | null }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant={client ? "outline" : "default"}>
        {client ? <Pencil /> : <Plus />} {client ? tc("edit") : t("new")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{client ? tc("edit") : t("new")}</DialogTitle>
          </DialogHeader>
          <ClientForm client={client} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
