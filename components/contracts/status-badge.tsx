import { Badge } from "@/components/ui/badge";

const VARIANT: Record<string, "success" | "warning" | "muted" | "destructive" | "secondary" | "outline"> = {
  draft: "outline",
  active: "success",
  on_hold: "warning",
  completed: "secondary",
  cancelled: "destructive",
};

export function StatusBadge({ code, name }: { code: string | null | undefined; name: string | null | undefined }) {
  if (!code) return <Badge variant="muted">—</Badge>;
  return <Badge variant={VARIANT[code] ?? "muted"}>{name ?? code}</Badge>;
}
