"use client";
import { UserButton } from "@clerk/nextjs";
import {
  BarChart3,
  Bell,
  Clock,
  FileInput,
  FolderKanban,
  History,
  LayoutDashboard,
  Menu,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { cn } from "@/lib/utils/cn";
import type { NavItem } from "./nav-config";

const ICONS = {
  dashboard: LayoutDashboard,
  clock: Clock,
  folder: FolderKanban,
  users: Users,
  truck: Truck,
  receipt: Receipt,
  wallet: Wallet,
  "file-input": FileInput,
  chart: BarChart3,
  settings: Settings,
  shield: ShieldCheck,
  history: History,
  upload: Upload,
} as const;

export interface AppShellProps {
  items: NavItem[];
  userName: string;
  roleLabel: string;
  unreadCount: number;
  companyName: string;
  children: React.ReactNode;
  searchSlot?: React.ReactNode;
  notificationsSlot?: React.ReactNode;
}

export function AppShell({ items, userName, roleLabel, unreadCount, companyName, children, searchSlot, notificationsSlot }: AppShellProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/") || (href === "/projects" && (pathname.startsWith("/contracts") || pathname.startsWith("/sub-contracts")));

  const nav = (
    <nav className="flex flex-col gap-0.5 p-2">
      {items.map((it) => {
        const Icon = ICONS[it.icon];
        return (
          <Link
            key={it.key}
            href={it.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(it.href) ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{t(it.key)}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow">
        {t("skip_to_content")}
      </a>
      {/* Sidebar – desktop */}
      <aside aria-label={t("main_navigation")} className="no-print hidden md:flex w-60 shrink-0 flex-col bg-brand-800 text-white">
        <div className="flex h-14 items-center gap-2 px-4 border-b border-white/10">
          <div className="text-xl font-bold tracking-tight">PGL</div>
          <div className="truncate text-xs text-brand-200">{companyName}</div>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-white/10 p-3 text-xs text-brand-200">
          <div className="font-medium text-white">{userName}</div>
          <div>{roleLabel}</div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-64 bg-brand-800 text-white shadow-xl">
            <div className="flex h-14 items-center justify-between px-4 border-b border-white/10">
              <div className="text-xl font-bold">PGL</div>
              <button onClick={() => setOpen(false)} aria-label="close" className="rounded p-1 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card px-3 md:px-5">
          <button className="rounded p-2 hover:bg-muted md:hidden" onClick={() => setOpen(true)} aria-label="menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 max-w-xl">
            {searchSlot ?? (
              <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
                <Search className="h-4 w-4" />
                <span>{t("search_placeholder")}</span>
                <kbd className="ms-auto hidden rounded border px-1.5 text-[10px] md:inline">Ctrl+K</kbd>
              </div>
            )}
          </div>
          <div className="relative">
            <button className="relative rounded-md p-2 hover:bg-muted" aria-label={t("notifications")} onClick={() => setNotifOpen((v) => !v)}>
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute -top-0.5 -end-0.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-white num">{unreadCount > 99 ? "99+" : unreadCount}</span>
              ) : null}
            </button>
            {notifOpen ? (
              <div className="absolute end-0 top-full z-40 mt-1 w-80 max-w-[90vw] rounded-md border border-border bg-card shadow-lg" onMouseLeave={() => setNotifOpen(false)}>
                {notificationsSlot}
              </div>
            ) : null}
          </div>
          <UserButton />
        </header>
        <main id="main" tabIndex={-1} className="flex-1 p-4 md:p-6 pb-20 md:pb-6 outline-none">{children}</main>

        {/* Bottom nav – mobile (spec §16.4) */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card md:hidden">
          {items
            .filter((i) => i.mobile)
            .map((it) => {
              const Icon = ICONS[it.icon];
              return (
                <Link key={it.key} href={it.href} className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]", isActive(it.href) ? "text-primary" : "text-muted-foreground")}>
                  <Icon className="h-5 w-5" />
                  {t(it.key)}
                </Link>
              );
            })}
        </nav>
      </div>
    </div>
  );
}
