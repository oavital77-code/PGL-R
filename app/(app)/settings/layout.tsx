import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, Circle } from "lucide-react";
import { requireCapability } from "@/lib/auth/authorize";
import { WIZARD_STEPS } from "@/lib/settings/defaults";
import { getSetting } from "@/lib/settings/service";
import { cn } from "@/lib/utils/cn";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability("settings.manage");
  const [ob, t, ts] = await Promise.all([getSetting("onboarding"), getTranslations("settings"), getTranslations("settings.steps")]);
  const extra = [{ key: "notifications", path: "/settings/notifications", required: false }] as const;
  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <aside className="no-print lg:w-64 shrink-0">
        <div className="rounded-lg border border-border bg-card p-2">
          <Link href="/settings/wizard" className="block rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted">
            {t("wizard.title")}
          </Link>
          <ul className="mt-1 space-y-0.5">
            {[...WIZARD_STEPS, ...extra].map((s, i) => {
              const done = ob.completed_steps.includes(s.key);
              return (
                <li key={s.key}>
                  <Link href={s.path} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-muted">
                    {done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className={cn("h-4 w-4", s.required ? "text-warning" : "text-muted-foreground")} />}
                    <span className="num text-xs text-muted-foreground w-5">{i + 1}</span>
                    <span className="flex-1">{ts(s.key)}</span>
                    {s.required && !done ? <span className="text-[10px] text-warning">{t("wizard.required")}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
