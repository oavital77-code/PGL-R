import type { Capability } from "@/lib/auth/capabilities";

export type NavIcon = "dashboard" | "clock" | "folder" | "users" | "receipt" | "chart" | "settings";

export interface NavChild {
  key: string;
  href: string;
  /** any of these capabilities grants the tab; empty = everyone */
  caps: Capability[];
}

export interface NavItem {
  key: string;
  href: string;
  icon: NavIcon;
  /** any of these capabilities grants the entry; empty = everyone */
  caps: Capability[];
  mobile?: boolean;
  /** path prefixes that highlight this entry (defaults to href) */
  matches?: string[];
  /** screens grouped under this entry, shown as tabs on each member page */
  children?: NavChild[];
}

/**
 * Sidebar: seven entries. Related screens are grouped and reached through tabs
 * (see <SectionTabs/>) rather than separate sidebar rows. URLs are unchanged.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: "dashboard", caps: [], mobile: true },
  { key: "hours", href: "/hours", icon: "clock", caps: ["hours.report_own"], mobile: true },
  { key: "projects", href: "/projects", icon: "folder", caps: ["projects.view"], matches: ["/projects", "/contracts", "/sub-contracts"], mobile: true },
  {
    key: "crm",
    href: "/clients",
    icon: "users",
    caps: ["clients.view", "suppliers.view"],
    matches: ["/clients", "/suppliers"],
    children: [
      { key: "clients", href: "/clients", caps: ["clients.view"] },
      { key: "suppliers", href: "/suppliers", caps: ["suppliers.view"] },
    ],
  },
  {
    key: "finance",
    href: "/invoices",
    icon: "receipt",
    caps: ["invoices.view", "receipts.manage", "supplier_invoices.manage", "supplier_invoices.approve"],
    matches: ["/invoices", "/receipts", "/supplier-invoices"],
    children: [
      { key: "invoices", href: "/invoices", caps: ["invoices.view"] },
      { key: "receipts", href: "/receipts", caps: ["receipts.manage"] },
      { key: "supplier_invoices", href: "/supplier-invoices", caps: ["supplier_invoices.manage", "supplier_invoices.approve"] },
    ],
  },
  { key: "reports", href: "/reports", icon: "chart", caps: ["reports.hours", "reports.financial"], mobile: true },
  {
    key: "admin",
    href: "/settings",
    icon: "settings",
    caps: ["settings.manage", "users.manage", "audit.view", "import.run"],
    matches: ["/settings", "/admin"],
    children: [
      { key: "settings", href: "/settings", caps: ["settings.manage"] },
      { key: "users", href: "/admin/users", caps: ["users.manage"] },
      { key: "audit", href: "/admin/audit", caps: ["audit.view"] },
      { key: "import", href: "/admin/import", caps: ["import.run"] },
    ],
  },
];

type Allowed = (c: Capability) => boolean;
const granted = (caps: Capability[], allowed: Allowed) => caps.length === 0 || caps.some(allowed);

/** Entries a user may see; a group points at its first visible child. */
export function navFor(allowed: Allowed): NavItem[] {
  return NAV_ITEMS.flatMap((item) => {
    if (!item.children) return granted(item.caps, allowed) ? [item] : [];
    const children = item.children.filter((c) => granted(c.caps, allowed));
    return children.length ? [{ ...item, href: children[0]!.href, children }] : [];
  });
}

/** Tabs for a group, filtered for the user – rendered at the top of each member page. */
export function sectionTabsFor(groupKey: string, allowed: Allowed): NavChild[] {
  const group = NAV_ITEMS.find((i) => i.key === groupKey);
  return (group?.children ?? []).filter((c) => granted(c.caps, allowed));
}
