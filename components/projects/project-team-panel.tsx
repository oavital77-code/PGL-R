"use client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { setAssignmentsAction } from "@/lib/sub-contracts/actions";
import { ActionButton } from "@/components/shared/action-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface TeamUser {
  id: string;
  name: string;
  department?: string | null;
  grade?: string | null;
}

/** Project-wide assignment matrix (spec §10.6): user × sub-contract, with who the person is. */
export function ProjectTeamPanel({ subContracts, assignments, users, canEdit }: { subContracts: { id: string; label: string; participates: boolean }[]; assignments: { userId: string; subContractId: string }[]; users: TeamUser[]; canEdit: boolean }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const [state, setState] = React.useState(() => new Set(assignments.map((a) => `${a.userId}|${a.subContractId}`)));
  const [q, setQ] = React.useState("");
  const toggle = (k: string) =>
    setState((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const save = async () => {
    for (const sc of subContracts) {
      const ids = users.filter((u) => state.has(`${u.id}|${sc.id}`)).map((u) => u.id);
      const res = await setAssignmentsAction(sc.id, ids);
      if (!res.ok) return res;
    }
    return { ok: true as const, data: undefined };
  };
  if (subContracts.length === 0) return <p className="text-sm text-muted-foreground">{t("no_sub_contracts")}</p>;
  const assignedCount = (u: TeamUser) => subContracts.filter((sc) => state.has(`${u.id}|${sc.id}`)).length;
  const visible = users.filter((u) => !q || `${u.name} ${u.department ?? ""} ${u.grade ?? ""}`.includes(q));
  return (
    <div className="space-y-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tc("search")} className="h-9 w-full max-w-xs rounded-md border border-input bg-card px-3 text-sm" aria-label={tc("search")} />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("employee")}</TableHead>
              <TableHead>{tc("department")}</TableHead>
              <TableHead>{tc("grade")}</TableHead>
              {subContracts.map((sc) => (
                <TableHead key={sc.id} className="text-center text-xs">
                  {sc.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((u) => (
              <TableRow key={u.id} className={assignedCount(u) ? "" : "text-muted-foreground"}>
                <TableCell className={assignedCount(u) ? "font-medium text-foreground" : ""}>{u.name}</TableCell>
                <TableCell>{u.department ?? "—"}</TableCell>
                <TableCell>{u.grade ?? "—"}</TableCell>
                {subContracts.map((sc) => (
                  <TableCell key={sc.id} className="text-center">
                    <input type="checkbox" aria-label={`${u.name} – ${sc.label}`} disabled={!canEdit || !sc.participates} checked={state.has(`${u.id}|${sc.id}`)} onChange={() => toggle(`${u.id}|${sc.id}`)} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {canEdit ? <ActionButton action={save}>{tc("save")}</ActionButton> : null}
    </div>
  );
}
