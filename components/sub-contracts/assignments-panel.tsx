"use client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { setAssignmentsAction } from "@/lib/sub-contracts/actions";
import { ActionButton } from "@/components/shared/action-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface User {
  id: string;
  name: string;
  department?: string | null;
  grade?: string | null;
}

/** Team tab (spec §8.3, §10.6): who works on this sub-contract, and – for those allowed – who may be added. */
export function AssignmentsPanel({ subContractId, users, assigned, canEdit }: { subContractId: string; users: User[]; assigned: string[]; canEdit: boolean }) {
  const t = useTranslations("assignments");
  const tc = useTranslations("common");
  const [sel, setSel] = React.useState(new Set(assigned));
  const [q, setQ] = React.useState("");
  const list = users.filter((u) => !q || `${u.name} ${u.department ?? ""} ${u.grade ?? ""}`.includes(q));
  const team = users.filter((u) => assigned.includes(u.id));
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tc("name")}</TableHead>
            <TableHead>{tc("department")}</TableHead>
            <TableHead>{tc("grade")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {team.length === 0 ? (
            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{t("none")}</TableCell></TableRow>
          ) : (
            team.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.department ?? "—"}</TableCell>
                <TableCell>{u.grade ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {canEdit ? (
        <>
          <h3 className="text-sm font-semibold">{t("edit_team")}</h3>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tc("search")} className="h-9 w-full max-w-xs rounded-md border border-input bg-card px-3 text-sm" aria-label={tc("search")} />
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
                <span>{u.name}</span>
                {u.department || u.grade ? <span className="text-xs text-muted-foreground">· {[u.department, u.grade].filter(Boolean).join(" · ")}</span> : null}
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
