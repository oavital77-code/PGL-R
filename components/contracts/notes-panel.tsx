"use client";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { addContractNoteAction, deleteContractNoteAction } from "@/lib/contracts/actions";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { Textarea } from "@/components/ui/textarea";

export interface NoteRow {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  canDelete: boolean;
}

/** Status notes journal (spec §8.5) with @mention hint. */
export function NotesPanel({ contractId, subContractId, rows }: { contractId: string; subContractId?: string; rows: NoteRow[] }) {
  const t = useTranslations("notes");
  const tc = useTranslations("common");
  return (
    <div className="space-y-4">
      <ActionForm action={addContractNoteAction} submitLabel={t("add")} resetOnSuccess>
        <input type="hidden" name="contractId" value={contractId} />
        {subContractId ? <input type="hidden" name="subContractId" value={subContractId} /> : null}
        <Textarea name="body" rows={3} placeholder={t("placeholder")} required />
      </ActionForm>
      <ul className="space-y-2">
        {rows.length === 0 ? <li className="text-sm text-muted-foreground">{tc("none")}</li> : null}
        {rows.map((n) => (
          <li key={n.id} className="rounded-md border border-border bg-card p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {n.author} · <span className="num">{n.createdAt}</span>
              </span>
              {n.canDelete ? (
                <ActionButton action={() => deleteContractNoteAction(n.id)} variant="ghost" size="icon" confirm={tc("confirm_delete")}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </ActionButton>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-sm">{n.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
