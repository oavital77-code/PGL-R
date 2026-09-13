"use client";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { searchAction } from "@/lib/search/actions";
import type { SearchHit } from "@/lib/search/global-search";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function GlobalSearch() {
  const t = useTranslations("nav");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const h = setTimeout(async () => {
      if (q.trim().length < 2) return setHits([]);
      setLoading(true);
      try {
        setHits(await searchAction(q));
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(h);
  }, [q, open]);

  const groups = React.useMemo(() => {
    const g = new Map<string, SearchHit[]>();
    for (const h of hits) (g.get(h.type) ?? g.set(h.type, []).get(h.type)!).push(h);
    return [...g.entries()];
  }, [hits]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted"
      >
        <Search className="h-4 w-4" />
        <span>{t("search_placeholder")}</span>
        <kbd className="ms-auto hidden rounded border px-1.5 text-[10px] md:inline">Ctrl+K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">{t("search_placeholder")}</DialogTitle>
          <Command shouldFilter={false} label="search">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Command.Input value={q} onValueChange={setQ} placeholder={t("search_placeholder")} className="h-11 w-full bg-transparent text-sm outline-none" autoFocus />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              {loading ? <div className="p-3 text-sm text-muted-foreground">{t("searching")}</div> : null}
              {!loading && q.trim().length >= 2 && hits.length === 0 ? <Command.Empty className="p-3 text-sm text-muted-foreground">{t("no_results")}</Command.Empty> : null}
              {groups.map(([type, items]) => (
                <Command.Group key={type} heading={t(`search_group_${type}`)} className="text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
                  {items.map((h) => (
                    <Command.Item
                      key={h.id}
                      value={h.id}
                      onSelect={() => {
                        setOpen(false);
                        router.push(h.href);
                      }}
                      className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-sm text-foreground aria-selected:bg-muted"
                    >
                      <span>{h.title}</span>
                      {h.subtitle ? <span className="text-xs text-muted-foreground">{h.subtitle}</span> : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
