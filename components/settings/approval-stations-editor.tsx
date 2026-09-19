"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { ApprovalStationSetting } from "@/lib/settings/defaults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface Props {
  initial: ApprovalStationSetting[];
  users: { id: string; name: string }[];
}

/**
 * Ordered list of approval stations. The list is posted as one JSON field
 * (approval_stations_json) that the settings action validates against the schema.
 */
export function ApprovalStationsEditor({ initial, users }: Props) {
  const t = useTranslations("settings.invoices");
  const [rows, setRows] = React.useState<ApprovalStationSetting[]>(initial);
  const update = (i: number, patch: Partial<ApprovalStationSetting>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const n = [...r];
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  return (
    <div className="space-y-2">
      <input type="hidden" name="approval_stations_json" value={JSON.stringify(rows)} />
      <p className="text-xs text-muted-foreground">{t("stations_hint")}</p>
      {rows.map((s, i) => (
        <div key={s.key} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
          <span className="num w-6 text-center text-sm text-muted-foreground">{i + 1}</span>
          <Input aria-label={t("station_name")} value={s.name} onChange={(e) => update(i, { name: e.target.value })} className="w-44" placeholder={t("station_name")} />
          <Select aria-label={t("station_kind")} value={s.kind} onChange={(e) => update(i, { kind: e.target.value as ApprovalStationSetting["kind"], user_id: e.target.value === "project_manager" ? null : s.user_id })} className="w-56">
            <option value="project_manager">{t("kind_project_manager")}</option>
            <option value="user">{t("kind_user")}</option>
          </Select>
          {s.kind === "user" ? (
            <Select aria-label={t("station_user")} value={s.user_id ?? ""} onChange={(e) => update(i, { user_id: e.target.value || null })} className="w-48">
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          ) : null}
          <span className="ms-auto inline-flex gap-1">
            <Button type="button" variant="ghost" size="icon" aria-label={t("move_up")} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="icon" aria-label={t("move_down")} disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
            <Button type="button" variant="ghost" size="icon" aria-label={t("remove_station")} onClick={() => setRows((r) => r.filter((_, j) => j !== i))}><Trash2 /></Button>
          </span>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setRows((r) => [...r, { key: `station-${Date.now()}`, name: "", kind: "user", user_id: null }])}><Plus /> {t("add_station")}</Button>
    </div>
  );
}
