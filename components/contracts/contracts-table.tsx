import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ContractRow } from "@/lib/reports/balances";
import { formatDate, formatMoney, formatPct } from "@/lib/i18n/format";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

/** Contracts list with balance columns (spec §8.1 tab, §8.2 summary). */
export async function ContractsTable({ rows, supplier }: { rows: ContractRow[]; supplier?: boolean }) {
  const [t, tc, ts] = await Promise.all([getTranslations("contracts"), getTranslations("common"), getTranslations("contract_status")]);
  const sum = (f: (r: ContractRow) => number | null | undefined) => rows.reduce((a, r) => a + (f(r) ?? 0), 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>{t("name")}</TableHead>
          <TableHead>{tc("status")}</TableHead>
          <TableHead>{t("signed_date")}</TableHead>
          <TableHead>{t("sub_contracts")}</TableHead>
          <TableHead>{t("total")}</TableHead>
          {supplier ? (
            <>
              <TableHead>{t("supplier_approved")}</TableHead>
            </>
          ) : (
            <>
              <TableHead>{t("submitted")}</TableHead>
              <TableHead>{t("paid")}</TableHead>
              <TableHead>{t("open_balance")}</TableHead>
              <TableHead>{t("remaining")}</TableHead>
              <TableHead>{t("progress")}</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={11} className="text-center text-muted-foreground">
              {t("empty")}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="num-cell">{r.numberInProject}</TableCell>
              <TableCell>
                <Link href={`/contracts/${r.id}`} className="font-medium text-primary hover:underline">
                  {r.name}
                </Link>
                {r.isLocked ? <Lock className="ms-1 inline h-3 w-3 text-muted-foreground" /> : null}
                {r.warnings.map((w) => (
                  <Badge key={w} variant="warning" className="ms-1">
                    ⚠ {t(`warn_${w}`)}
                  </Badge>
                ))}
              </TableCell>
              <TableCell>{r.statusCode ? <Badge variant={r.statusCode === "active" ? "success" : r.statusCode === "cancelled" ? "destructive" : r.statusCode === "on_hold" ? "warning" : "secondary"}>{ts(r.statusCode)}</Badge> : "—"}</TableCell>
              <TableCell className="num-cell">{formatDate(r.signedDate)}</TableCell>
              <TableCell className="num-cell">{r.subContracts.length}</TableCell>
              <TableCell className="num-cell">{formatMoney(r.balances.totalAmount)}</TableCell>
              {supplier ? (
                <TableCell className="num-cell">{formatMoney(r.supplierCost)}</TableCell>
              ) : (
                <>
                  <TableCell className="num-cell">{formatMoney(r.balances.submitted)}</TableCell>
                  <TableCell className="num-cell">{formatMoney(r.balances.paid)}</TableCell>
                  <TableCell className="num-cell">{formatMoney(r.balances.openBalance)}</TableCell>
                  <TableCell className="num-cell">{formatMoney(r.balances.remaining)}</TableCell>
                  <TableCell className="num-cell">{formatPct(r.balances.progressPct)}</TableCell>
                </>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
      {rows.length > 1 ? (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5}>{tc("total")}</TableCell>
            <TableCell className="num-cell">{formatMoney(sum((r) => r.balances.totalAmount))}</TableCell>
            {supplier ? (
              <TableCell className="num-cell">{formatMoney(sum((r) => r.supplierCost))}</TableCell>
            ) : (
              <>
                <TableCell className="num-cell">{formatMoney(sum((r) => r.balances.submitted))}</TableCell>
                <TableCell className="num-cell">{formatMoney(sum((r) => r.balances.paid))}</TableCell>
                <TableCell className="num-cell">{formatMoney(sum((r) => r.balances.openBalance))}</TableCell>
                <TableCell className="num-cell">{formatMoney(sum((r) => r.balances.remaining))}</TableCell>
                <TableCell />
              </>
            )}
          </TableRow>
        </TableFooter>
      ) : null}
    </Table>
  );
}
