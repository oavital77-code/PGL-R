import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { listRecent } from "@/lib/notifications/service";
import { MarkAllReadButton } from "./notifications-actions";

export async function NotificationsList({ userId }: { userId: string }) {
  const [items, t, f] = await Promise.all([listRecent(userId), getTranslations("notifications"), getFormatter()]);
  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-medium">
        <span>{t("title")}</span>
        <MarkAllReadButton label={t("mark_all_read")} />
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((n) => (
            <li key={n.id} className={n.isRead ? "opacity-70" : ""}>
              <Link href={n.link ?? "#"} className="block px-3 py-2 hover:bg-muted">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body ? <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div> : null}
                <div className="mt-0.5 text-[11px] text-muted-foreground num">{f.dateTime(n.createdAt, { dateStyle: "short", timeStyle: "short" })}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
