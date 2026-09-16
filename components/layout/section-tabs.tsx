"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import type { NavChild } from "./nav-config";

/** Secondary navigation between the screens of one sidebar group (spec §16.4 – flat, one level). */
export function SectionTabs({ tabs }: { tabs: NavChild[] }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  if (tabs.length < 2) return null;
  return (
    <nav aria-label={t("section_navigation")} className="no-print -mt-1 mb-5 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
