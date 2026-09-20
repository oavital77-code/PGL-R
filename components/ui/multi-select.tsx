"use client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Input } from "./input";

export interface MultiOption {
  id: string;
  name: string;
}

/**
 * A list of options where one click toggles one option, so choosing several needs no modifier
 * key (spec §12.4, report filters). An empty selection means every option – that is how the
 * reports read an empty filter – and the summary line says so.
 */
export function MultiSelect({ options, value, onChange, searchFrom = 8 }: { options: MultiOption[]; value: string[]; onChange: (values: string[]) => void; searchFrom?: number }) {
  const t = useTranslations("common");
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  const selected = React.useMemo(() => new Set(value), [value]);
  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  // "select all" takes what the search leaves visible, and keeps whatever is selected outside it
  const selectAll = () => onChange([...new Set([...value, ...shown.map((o) => o.id)])]);
  const allShownSelected = shown.length > 0 && shown.every((o) => selected.has(o.id));

  return (
    <div className="rounded-md border border-input bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1">
        <span className="truncate text-xs text-muted-foreground">{value.length ? t("selected_count", { count: value.length }) : t("all")}</span>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={selectAll} disabled={allShownSelected} className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-muted disabled:opacity-40">
            {t("select_all")}
          </button>
          <button type="button" onClick={() => onChange([])} disabled={!value.length} className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-muted disabled:opacity-40">
            {t("clear")}
          </button>
        </div>
      </div>
      {options.length >= searchFrom ? (
        <div className="border-b border-border p-1">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} className="h-7 text-xs" />
        </div>
      ) : null}
      <div className="max-h-40 overflow-auto p-1">
        {shown.length ? (
          shown.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted">
              <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="shrink-0" />
              <span className="truncate">{o.name}</span>
            </label>
          ))
        ) : (
          <p className="px-1.5 py-2 text-xs text-muted-foreground">{t("no_matches")}</p>
        )}
      </div>
    </div>
  );
}
