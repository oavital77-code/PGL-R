import { describe, expect, it } from "vitest";
import { buildApprovalChain, canDecide, ChainError, currentStation, isChainMember } from "@/lib/invoices/approval-chain";
import { DEFAULT_APPROVAL_STATIONS } from "@/lib/settings/defaults";

const users = new Map([
  ["u-eco", { id: "u-eco", name: "דנה כלכלנית" }],
  ["u-ceo", { id: "u-ceo", name: "יוסי מנכ\"ל" }],
]);
const stations = [
  DEFAULT_APPROVAL_STATIONS[0]!,
  { ...DEFAULT_APPROVAL_STATIONS[1]!, user_id: "u-eco" },
  { ...DEFAULT_APPROVAL_STATIONS[2]!, user_id: "u-ceo" },
];

describe("buildApprovalChain", () => {
  it("resolves project manager → economist → CEO in order", () => {
    const chain = buildApprovalChain(stations, { projectManager: { id: "u-pm", name: "רון מנהל" }, users });
    expect(chain.map((s) => [s.key, s.userId])).toEqual([
      ["project_manager", "u-pm"],
      ["economist", "u-eco"],
      ["ceo", "u-ceo"],
    ]);
    expect(chain[0]!.userName).toBe("רון מנהל");
  });

  it("folds two consecutive stations held by the same person into one", () => {
    const chain = buildApprovalChain(stations, { projectManager: { id: "u-eco", name: "דנה כלכלנית" }, users });
    expect(chain).toHaveLength(2);
    expect(chain[0]!.name).toBe("מנהל פרויקט / כלכלן");
    expect(chain[1]!.key).toBe("ceo");
  });

  it("refuses a station that has nobody: no project manager, or a user not chosen", () => {
    expect(() => buildApprovalChain(stations, { projectManager: null, users })).toThrow(ChainError);
    try {
      buildApprovalChain(stations, { projectManager: null, users });
    } catch (e) {
      expect((e as ChainError).stationName).toBe("מנהל פרויקט");
    }
    expect(() => buildApprovalChain([{ ...DEFAULT_APPROVAL_STATIONS[1]!, user_id: null }], { projectManager: null, users })).toThrow(ChainError);
    expect(() => buildApprovalChain([{ ...DEFAULT_APPROVAL_STATIONS[1]!, user_id: "u-gone" }], { projectManager: null, users })).toThrow(ChainError);
  });

  it("an empty configuration yields an empty chain", () => {
    expect(buildApprovalChain([], { projectManager: null, users })).toEqual([]);
  });
});

describe("chain state", () => {
  const chain = buildApprovalChain(stations, { projectManager: { id: "u-pm", name: "רון" }, users });
  const at = (step: number, status = "pending_approval") => ({ status, approvalChain: chain, approvalStep: step });

  it("names the waiting station and who may decide there", () => {
    expect(currentStation(at(2))?.key).toBe("economist");
    expect(canDecide(at(2), { id: "u-eco", role: "employee" })).toBe(true);
    expect(canDecide(at(2), { id: "u-pm", role: "manager" })).toBe(false);
    expect(canDecide(at(2), { id: "u-admin", role: "admin" })).toBe(true);
  });

  it("nobody decides outside pending_approval", () => {
    expect(currentStation(at(2, "draft"))).toBeNull();
    expect(canDecide(at(2, "approved"), { id: "u-eco", role: "admin" })).toBe(false);
    expect(currentStation({ status: "pending_approval", approvalChain: null, approvalStep: 1 })).toBeNull();
  });

  it("chain members may open the invoice", () => {
    expect(isChainMember(at(1), "u-ceo")).toBe(true);
    expect(isChainMember(at(1), "u-other")).toBe(false);
    expect(isChainMember({ approvalChain: null }, "u-ceo")).toBe(false);
  });
});
