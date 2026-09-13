/**
 * Capability matrix (spec §3.2). Admin always has everything. 🔒 capabilities
 * cannot be delegated. Manager/employee defaults can be overridden by the admin
 * in settings.permissions.
 */
export const CAPABILITIES = [
  "hours.report_own",
  "hours.report_for_others",
  "hours.view_others",
  "hours.edit_locked",
  "reports.hours",
  "reports.financial",
  "reports.schedule",
  "clients.view",
  "clients.edit",
  "suppliers.view",
  "suppliers.edit",
  "projects.view",
  "projects.edit",
  "contracts.view",
  "contracts.edit",
  "contracts.unlock",
  "assignments.manage",
  "invoices.view",
  "invoices.create",
  "invoices.approve",
  "invoices.sign",
  "invoices.send",
  "invoices.cancel",
  "receipts.manage",
  "supplier_invoices.manage",
  "supplier_invoices.approve",
  "dashboard.financial",
  "settings.manage",
  "users.manage",
  "audit.view",
  "import.run",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type Role = "admin" | "manager" | "employee";

/** Admin-only, non-delegable */
export const LOCKED_CAPABILITIES: ReadonlySet<Capability> = new Set([
  "hours.edit_locked",
  "contracts.unlock",
  "settings.manage",
  "users.manage",
  "audit.view",
  "import.run",
]);

export const DEFAULT_ROLE_CAPABILITIES: Record<Exclude<Role, "admin">, ReadonlySet<Capability>> = {
  manager: new Set<Capability>(["hours.report_own", "hours.report_for_others", "hours.view_others", "reports.hours"]),
  employee: new Set<Capability>(["hours.report_own"]),
};

export type OthersScope = "department" | "all";

export interface PermissionOverrides {
  manager: Record<string, boolean>;
  employee: Record<string, boolean>;
}

export function roleCapabilities(role: Role, overrides?: PermissionOverrides | null): Set<Capability> {
  if (role === "admin") return new Set(CAPABILITIES);
  const base = new Set(DEFAULT_ROLE_CAPABILITIES[role]);
  const ov = overrides?.[role] ?? {};
  for (const cap of CAPABILITIES) {
    if (LOCKED_CAPABILITIES.has(cap)) continue;
    if (ov[cap] === true) base.add(cap);
    else if (ov[cap] === false) base.delete(cap);
  }
  return base;
}

/** Capability groups used by the permissions settings screen. */
export const CAPABILITY_GROUPS: { group: string; caps: Capability[] }[] = [
  { group: "hours", caps: ["hours.report_own", "hours.report_for_others", "hours.view_others", "hours.edit_locked"] },
  { group: "reports", caps: ["reports.hours", "reports.financial", "reports.schedule"] },
  { group: "crm", caps: ["clients.view", "clients.edit", "suppliers.view", "suppliers.edit"] },
  { group: "contracts", caps: ["projects.view", "projects.edit", "contracts.view", "contracts.edit", "contracts.unlock", "assignments.manage"] },
  { group: "invoices", caps: ["invoices.view", "invoices.create", "invoices.approve", "invoices.sign", "invoices.send", "invoices.cancel", "receipts.manage"] },
  { group: "suppliers_inv", caps: ["supplier_invoices.manage", "supplier_invoices.approve"] },
  { group: "system", caps: ["dashboard.financial", "settings.manage", "users.manage", "audit.view", "import.run"] },
];
