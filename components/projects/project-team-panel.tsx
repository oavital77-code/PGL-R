"use client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { setAssignmentsAction } from "@/lib/sub-contracts/actions";
import { ActionButton } from "@/components/shared/action-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Project-wide assignment matrix (spec §10.6): user × sub-contract. */
export function ProjectTeamPanel({ subContracts, assignments, users, canEdit }: { subContracts: { id: string; label: string; participates: boolean }[]; assignments: { userId: string; subContractId: string }[]; users: { id: string; name: string }[]; canEdit: boolean }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const [state, setState] = React.useState(() => new Set(assignments.map((a) => `${a.userId}|${a.subContractId}`)));
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
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("employee")}</TableHead>
            {subContracts.map((sc) => (
              <TableHead key={sc.id} className="text-center text-xs">
                {sc.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              {subContracts.map((sc) => (
                <TableCell key={sc.id} className="text-center">
                  <input type="checkbox" disabled={!canEdit || !sc.participates} checked={state.has(`${u.id}|${sc.id}`)} onChange={() => toggle(`${u.id}|${sc.id}`)} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {canEdit ? <ActionButton action={save}>{tc("save")}</ActionButton> : null}
    </div>
  );
}
