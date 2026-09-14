"use client";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { updateContractAction } from "@/lib/contracts/actions";
import type { contracts } from "@/lib/db/schema";
import type { ContractFormLookups } from "@/lib/projects/lookups";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContractHeaderFields } from "./contract-header-fields";

export function ContractEditDialog({ contract, lookups, suppliers, statusCode }: { contract: typeof contracts.$inferSelect; lookups: ContractFormLookups; suppliers: { id: string; name: string }[]; statusCode: string | null }) {
  const tc = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={contract.isLocked}>
        <Pencil /> {tc("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{tc("edit")}</DialogTitle>
          </DialogHeader>
          <ActionForm action={updateContractAction} onSuccess={() => setOpen(false)}>
            <input type="hidden" name="id" value={contract.id} />
            <input type="hidden" name="projectId" value={contract.projectId} />
            <input type="hidden" name="direction" value={contract.direction} />
            <ContractHeaderFields contract={contract} direction={contract.direction} lookups={lookups} suppliers={suppliers} statusCode={statusCode} />
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
