/**
 * Customer-invoice approval chain (customer decision 18/09/2026, DEVIATIONS.md).
 *
 * The stations come from settings (invoices.approval_stations) and are resolved to people when
 * a draft is submitted: "project manager" is the project's manager, a "user" station is the
 * person chosen in settings. The resolved chain is stored on the invoice, so a later change in
 * settings never moves an invoice that is already on its way. Pure: no database access.
 */
import type { ApprovalStation } from "@/lib/db/schema/invoicing";
import type { ApprovalStationSetting } from "@/lib/settings/defaults";

export interface ChainPerson {
  id: string;
  name: string;
}

export class ChainError extends Error {
  constructor(
    public readonly code: "station_without_user",
    public readonly stationName: string,
    public readonly stationKind: "project_manager" | "user",
  ) {
    super(`${code}: ${stationName}`);
    this.name = "ChainError";
  }
}

/**
 * Resolves the configured stations for one invoice. A station whose person is the same as the
 * previous station's is folded into it (one approval, both names), so a project manager who is
 * also the economist does not approve the same invoice twice in a row.
 */
export function buildApprovalChain(stations: ApprovalStationSetting[], ctx: { projectManager: ChainPerson | null; users: ReadonlyMap<string, ChainPerson> }): ApprovalStation[] {
  const out: ApprovalStation[] = [];
  for (const st of stations) {
    const person = st.kind === "project_manager" ? ctx.projectManager : st.user_id ? (ctx.users.get(st.user_id) ?? null) : null;
    if (!person) throw new ChainError("station_without_user", st.name, st.kind);
    const prev = out[out.length - 1];
    if (prev && prev.userId === person.id) {
      prev.name = `${prev.name} / ${st.name}`;
      continue;
    }
    out.push({ key: st.key, name: st.name, userId: person.id, userName: person.name });
  }
  return out;
}

export interface ChainState {
  status: string;
  approvalChain: ApprovalStation[] | null;
  approvalStep: number;
}

/** The station an invoice is waiting at, or null when it is not in approval. */
export function currentStation(inv: ChainState): ApprovalStation | null {
  if (inv.status !== "pending_approval" || !inv.approvalChain) return null;
  return inv.approvalChain[inv.approvalStep - 1] ?? null;
}

/** Anyone named in the chain may open the invoice, whatever their role. */
export function isChainMember(inv: { approvalChain: ApprovalStation[] | null }, userId: string): boolean {
  return (inv.approvalChain ?? []).some((s) => s.userId === userId);
}

/** The person at the current station decides; an admin may decide on their behalf. */
export function canDecide(inv: ChainState, user: { id: string; role: string }): boolean {
  const st = currentStation(inv);
  if (!st) return false;
  return st.userId === user.id || user.role === "admin";
}
