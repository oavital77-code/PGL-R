import type { Capability } from "@/lib/auth/capabilities";

export interface NavItem {
  key: string;
  href: string;
  icon: "dashboard" | "clock" | "folder" | "users" | "truck" | "receipt" | "wallet" | "file-input" | "chart" | "settings" | "shield" | "history" | "upload";
  /** any of these capabilities grants the item; empty = everyone */
  caps: Capability[];
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: "dashboard", caps: [], mobile: true },
  { key: "hours", href: "/hours", icon: "clock", caps: ["hours.report_own"], mobile: true },
  { key: "projects", href: "/projects", icon: "folder", caps: ["projects.view"] },
  { key: "clients", href: "/clients", icon: "users", caps: ["clients.view"] },
  { key: "suppliers", href: "/suppliers", icon: "truck", caps: ["suppliers.view"] },
  { key: "invoices", href: "/invoices", icon: "receipt", caps: ["invoices.view"] },
  { key: "receipts", href: "/receipts", icon: "wallet", caps: ["receipts.manage"] },
  { key: "supplier_invoices", href: "/supplier-invoices", icon: "file-input", caps: ["supplier_invoices.manage", "supplier_invoices.approve"] },
  { key: "reports", href: "/reports", icon: "chart", caps: ["reports.hours", "reports.financial"], mobile: true },
  { key: "users", href: "/admin/users", icon: "shield", caps: ["users.manage"] },
  { key: "audit", href: "/admin/audit", icon: "history", caps: ["audit.view"] },
  { key: "import", href: "/admin/import", icon: "upload", caps: ["import.run"] },
  { key: "settings", href: "/settings", icon: "settings", caps: ["settings.manage"] },
];
