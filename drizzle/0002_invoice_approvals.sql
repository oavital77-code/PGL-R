CREATE TABLE "invoice_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"invoice_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"station_key" text NOT NULL,
	"station_name" text NOT NULL,
	"user_id" uuid NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"comment" text
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "approval_chain" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "approval_step" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_approvals" ADD CONSTRAINT "invoice_approvals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_approvals" ADD CONSTRAINT "invoice_approvals_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_approvals" ADD CONSTRAINT "invoice_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_approvals_invoice_idx" ON "invoice_approvals" USING btree ("invoice_id");--> statement-breakpoint
-- audit + updated_at triggers and RLS deny-all, as 0001 does for every table that existed then
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON invoice_approvals FOR EACH ROW EXECUTE FUNCTION app_audit_trigger();--> statement-breakpoint
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON invoice_approvals FOR EACH ROW EXECUTE FUNCTION app_set_updated_at();--> statement-breakpoint
ALTER TABLE invoice_approvals ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE invoice_approvals FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  CREATE POLICY deny_all ON invoice_approvals FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
EXCEPTION WHEN undefined_object THEN NULL; END $$;
