import { getFormatter, getTranslations } from "next-intl/server";
import { diffRecord, queryAudit, type AuditFilter } from "@/lib/audit/query";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fmt = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Reusable audit list – used by /admin/audit and by every entity "history" tab. */
export async function AuditTable({ filter, compact }: { filter: AuditFilter; compact?: boolean }) {
  const [rows, t, f] = await Promise.all([queryAudit(filter), getTranslations("audit"), getFormatter()]);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("time")}</TableHead>
          <TableHead>{t("user")}</TableHead>
          {compact ? null : <TableHead>{t("table")}</TableHead>}
          <TableHead>{t("action")}</TableHead>
          <TableHead>{t("show_diff")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              {t("empty")}
            </TableCell>
          </TableRow>
        ) : (
          rows.map(({ a, userName }) => {
            const diff = a.action === "update" ? diffRecord(a.before, a.after) : [];
            const reason = (a.after as { __reason?: string } | null)?.__reason;
            return (
              <TableRow key={a.id} className="align-top">
                <TableCell className="num-cell whitespace-nowrap text-xs">{f.dateTime(a.changedAt, { dateStyle: "short", timeStyle: "medium" })}</TableCell>
                <TableCell className="whitespace-nowrap">{userName ?? t("system")}</TableCell>
                {compact ? null : <TableCell className="num-cell text-xs">{a.tableName}</TableCell>}
                <TableCell>
                  <Badge variant={a.action === "insert" ? "success" : a.action === "delete" ? "destructive" : "secondary"}>{t(a.action)}</Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {reason ? (
                    <div className="mb-1">
                      <span className="font-medium">{t("reason")}:</span> {reason}
                    </div>
                  ) : null}
                  {a.action === "update" ? (
                    diff.length === 0 ? (
                      "—"
                    ) : (
                      <table className="w-full">
                        <tbody>
                          {diff.map((d) => (
                            <tr key={d.field}>
                              <td className="num-cell pe-2 text-muted-foreground">{d.field}</td>
                              <td className="pe-2 text-destructive line-through">{fmt(d.before)}</td>
                              <td className="text-success">{fmt(d.after)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-primary">{t("show_diff")}</summary>
                      <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-[11px] num" dir="ltr">
                        {JSON.stringify(a.action === "delete" ? a.before : a.after, null, 2)}
                      </pre>
                    </details>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
