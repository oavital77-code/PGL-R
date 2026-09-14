"use client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { createContractAction } from "@/lib/contracts/actions";
import type { ContractFormLookups } from "@/lib/projects/lookups";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContractHeaderFields } from "./contract-header-fields";
import { PricingFields } from "./pricing-fields";

export function NewContractDialog({ projectId, direction, lookups, defaultClientId, suppliers }: { projectId: string; direction: "income" | "expense"; lookups: ContractFormLookups; defaultClientId?: string; suppliers?: { id: string; name: string }[] }) {
  const t = useTranslations("contracts");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [withSubs, setWithSubs] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant={direction === "income" ? "default" : "secondary"}>
        <Plus /> {direction === "income" ? t("new_client_contract") : t("new_supplier_contract")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{direction === "income" ? t("new_client_contract") : t("new_supplier_contract")}</DialogTitle>
          </DialogHeader>
          <ActionForm
            action={createContractAction}
            onSuccess={(d) => {
              setOpen(false);
              router.push(`/contracts/${d.id}`);
            }}
          >
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="direction" value={direction} />
            <ContractHeaderFields contract={null} direction={direction} lookups={lookups} defaultClientId={defaultClientId} suppliers={suppliers ?? []} />
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="withSubContracts" checked={withSubs} onChange={(e) => setWithSubs(e.target.checked)} /> {t("with_sub_contracts")}
            </label>
            <p className="text-xs text-muted-foreground">{withSubs ? t("with_sub_contracts_hint") : t("without_sub_contracts_hint")}</p>
            {!withSubs ? <PricingFields sc={null} unitTypes={lookups.unitTypes} templates={lookups.templates} showTemplate /> : null}
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
