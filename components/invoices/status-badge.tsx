import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

const V: Record<string, "outline" | "secondary" | "success" | "warning" | "destructive" | "muted"> = { draft: "outline", pending_approval: "warning", approved: "secondary", signed: "secondary", sent: "success", partially_paid: "warning", paid: "success", cancelled: "destructive" };

/** Status pill; while in approval it names the station the invoice is waiting at. */
export function InvoiceStatusBadge({ status, station }: { status: string; station?: string | null }) {
  const t = useTranslations("invoices.status");
  const ti = useTranslations("invoices");
  const label = status === "pending_approval" && station ? ti("waiting_for", { station }) : t(status as "draft");
  return <Badge variant={V[status] ?? "muted"}>{label}</Badge>;
}
