"use client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { setAssignmentsAction } from "@/lib/sub-contracts/actions";
import { ActionButton } from "@/components/shared/action-button";
import { Badge } from "@/components/ui/badge";

/** Team tab (spec §8.3, §10.6): multi-select of active users. */
export function AssignmentsPanel({ subContractId, users, assigned, canEdit }: { subContractId: string; users: { id: string; name: string; department?: string | null }[]; assigned: string[]; canEdit: boolean }) {
  const t = useTranslations("assignments");
  const tc = useTranslations("common");
  const [sel, setSel] = React.useState(new Set(assigned));
  const [q, setQ] = React.useState("");
  const list = users.filter((u) => u.name.includes(q));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {assigned.length === 0 ? <span className="text-sm text-muted-foreground">{t("none")}</span> : null}
        {assigned.map((id) => (
          <Badge key={id} variant="secondary">
            {users.find((u) => u.id === id)?.name ?? id}
          </Badge>
        ))}
      </div>
      {canEdit ? (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tc("search")} className="h-9 w-full max-w-xs rounded-md border border-input bg-card px-3 text-sm" />
          <div className="grid gap-1 md:grid-cols-3">
            {list.map((u) => (
              <label key={u.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={sel.has(u.id)}
                  onChange={(e) =>
                    setSel((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(u.id);
                      else n.delete(u.id);
                      return n;
                    })
                  }
                />
                {u.name}
                {u.department ? <span className="text-xs text-muted-foreground">· {u.department}</span> : null}
              </label>
            ))}
          </div>
          <ActionButton action={() => setAssignmentsAction(subContractId, [...sel])}>{tc("save")}</ActionButton>
          <p className="text-xs text-muted-foreground">{t("remove_hint")}</p>
        </>
      ) : null}
    </div>
  );
}
