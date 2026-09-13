"use client";
import { Trash2, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { deleteDocumentAction, uploadDocumentsAction } from "@/lib/documents/actions";
import type { DocumentEntity } from "@/lib/storage";
import { ActionButton } from "./action-button";
import { ActionForm } from "./action-form";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

export function UploadDocumentsForm({ entityType, entityId, types, defaultType }: { entityType: DocumentEntity; entityId: string; types: { code: string; name: string }[]; defaultType?: string }) {
  const t = useTranslations("documents");
  const [names, setNames] = React.useState<string[]>([]);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <ActionForm action={uploadDocumentsAction} submitLabel={t("upload")} resetOnSuccess onSuccess={() => setNames([])} className="rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <div
          className={cn("flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-sm text-muted-foreground", drag ? "border-primary bg-brand-50" : "border-border")}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (inputRef.current) {
              inputRef.current.files = e.dataTransfer.files;
              setNames([...e.dataTransfer.files].map((f) => f.name));
            }
          }}
        >
          <UploadCloud className="mb-2 h-6 w-6" />
          <span>{t("drop_hint")}</span>
          {names.length ? <span className="mt-2 text-xs text-foreground">{names.join(", ")}</span> : null}
          <input ref={inputRef} type="file" name="files" multiple className="hidden" onChange={(e) => setNames([...(e.target.files ?? [])].map((f) => f.name))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="documentType">{t("type")}</Label>
          <Select id="documentType" name="documentType" defaultValue={defaultType ?? ""}>
            <option value="">—</option>
            {types.map((x) => (
              <option key={x.code} value={x.code}>
                {x.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </ActionForm>
  );
}

export function DeleteDocumentButton({ id }: { id: string }) {
  const t = useTranslations("common");
  return (
    <ActionButton action={() => deleteDocumentAction(id)} variant="ghost" size="icon" confirm={t("confirm_delete")} aria-label={t("delete")}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </ActionButton>
  );
}
