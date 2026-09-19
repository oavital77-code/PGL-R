import type { NotificationType } from "./service";

/** Event catalogue with default channels (spec §13.2). */
export const NOTIFICATION_EVENTS: { type: NotificationType; in_app: boolean; email: boolean }[] = [
  { type: "invoice.pending_approval", in_app: true, email: true },
  { type: "invoice.approved", in_app: true, email: false },
  { type: "invoice.rejected", in_app: true, email: true },
  { type: "invoice.signed", in_app: true, email: false },
  { type: "invoice.sent", in_app: true, email: false },
  { type: "invoice.email_failed", in_app: true, email: true },
  { type: "invoice.overdue", in_app: true, email: true },
  { type: "invoice.retainer_draft", in_app: true, email: false },
  { type: "invoice.cancelled", in_app: true, email: false },
  { type: "hours.reminder", in_app: true, email: true },
  { type: "hours.month_locked", in_app: true, email: false },
  { type: "hours.period_unlocked", in_app: true, email: true },
  { type: "hours.reported_for_you", in_app: true, email: false },
  { type: "contract.progress", in_app: true, email: false },
  { type: "supplier.over_budget", in_app: true, email: true },
  { type: "supplier.progress_vs_client", in_app: true, email: true },
  { type: "supplier_invoice.pending_approval", in_app: true, email: true },
  { type: "supplier_invoice.decided", in_app: true, email: false },
  { type: "index.fetch_failed", in_app: true, email: true },
  { type: "index.missing", in_app: true, email: true },
  { type: "note.mention", in_app: true, email: false },
  { type: "report.schedule_failed", in_app: true, email: true },
  { type: "backup.failed", in_app: false, email: true },
];
