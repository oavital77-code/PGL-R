import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

const V: Record<string, "outline" | "secondary" | "success" | "warning" | "destructive" | "muted"> = { draft: "outline", pending_approval: "warning", approved: "secondary", signed: "secondary", sent: "success", partially_paid: "warning", paid: "success", cancelled: "destructive" };

export function InvoiceStatusBadge({ status }: { status: string }) {
  const t = useTranslations("invoices.status");
  return <Badge variant={V[status] ?? "muted"}>{t(status as "draft")}</Badge>;
}
