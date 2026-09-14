-- PGL-R – הקמת בסיס נתונים מלאה בהרצה אחת.
--
-- מיועד לפרויקט Supabase ריק, להדבקה ב-SQL Editor, כשאין גישת Postgres ישירה
-- מהמחשב. שקול ל: pnpm db:migrate && pnpm db:seed && pnpm storage:init.
--
-- הקובץ נוצר מתוך drizzle/0000_init.sql + drizzle/0001_triggers_rls.sql + lib/db/seed.
-- *** אחרי הוספת migration חדש ב-drizzle/ יש לייצר אותו מחדש, אחרת הוא יפגר מהסכמה. ***
--
-- מריצים פעם אחת בלבד. הרצה שנייה תיכשל על טיפוסים וטבלאות שכבר קיימים.
BEGIN;
-- ============ 1. סכמה (drizzle/0000_init.sql) ============
CREATE TYPE "public"."approval_decision" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('insert', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."client_kind" AS ENUM('company', 'authority', 'private', 'other');--> statement-breakpoint
CREATE TYPE "public"."contract_direction" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."document_entity" AS ENUM('project', 'contract', 'sub_contract', 'invoice', 'supplier_invoice', 'client', 'supplier', 'receipt', 'company', 'user', 'import', 'report_export');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'delivered', 'opened', 'bounced', 'failed');--> statement-breakpoint
CREATE TYPE "public"."estimate_type" AS ENUM('initial', 'tender', 'execution', 'actual', 'other');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('xlsx', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."hourly_mode" AS ENUM('rate_card', 'custom');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('validating', 'ready', 'importing', 'done', 'failed', 'rolled_back');--> statement-breakpoint
CREATE TYPE "public"."index_source" AS ENUM('cbs_api', 'manual');--> statement-breakpoint
CREATE TYPE "public"."invoice_kind" AS ENUM('proforma', 'credit');--> statement-breakpoint
CREATE TYPE "public"."invoice_line_type" AS ENUM('milestone', 'hours', 'retainer', 'unit', 'extra', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'pending_approval', 'approved', 'signed', 'sent', 'partially_paid', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('he', 'en');--> statement-breakpoint
CREATE TYPE "public"."pricing_method" AS ENUM('fixed_price', 'hourly', 'retainer', 'pct_of_cost', 'per_unit');--> statement-breakpoint
CREATE TYPE "public"."receipt_method" AS ENUM('transfer', 'check', 'credit_card', 'cash', 'other');--> statement-breakpoint
CREATE TYPE "public"."schedule_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."supplier_invoice_status" AS ENUM('pending', 'partially_approved', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'employee');--> statement-breakpoint
CREATE TABLE "billing_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_id" uuid NOT NULL,
	"hourly_rate" numeric(10, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "billing_rates_grade_from" UNIQUE("grade_id","effective_from")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"manager_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "employee_cost_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"hourly_cost" numeric(10, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "employee_cost_rates_user_from" UNIQUE("user_id","effective_from")
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role" "user_role" DEFAULT 'employee' NOT NULL,
	"department_id" uuid,
	"grade_id" uuid,
	"standard_hours_per_day" numeric(4, 2),
	"work_days" integer[] DEFAULT '{0,1,2,3,4}'::int[] NOT NULL,
	"employment_start" date,
	"employment_end" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"locale" "locale" DEFAULT 'he' NOT NULL,
	"phone" text,
	"signature_image_path" text,
	"signature_title" text,
	"external_payroll_id" text,
	"invited_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"tax_id" text,
	"client_kind" "client_kind" DEFAULT 'company' NOT NULL,
	"address_street" text,
	"address_city" text,
	"address_zip" text,
	"phone" text,
	"email" text,
	"website" text,
	"payment_terms_days" integer,
	"index_linked_default" boolean,
	"vat_exempt" boolean DEFAULT false NOT NULL,
	"withholding_tax_pct" numeric(5, 2),
	"withholding_valid_until" date,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"client_id" uuid,
	"supplier_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"role_title" text,
	"email" text,
	"phone" text,
	"receives_invoices" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "contacts_exactly_one_owner" CHECK (("contacts"."client_id" is not null)::int + ("contacts"."supplier_id" is not null)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"tax_id" text,
	"field" text,
	"address_street" text,
	"address_city" text,
	"address_zip" text,
	"phone" text,
	"email" text,
	"website" text,
	"payment_terms_days" integer,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"contract_id" uuid NOT NULL,
	"sub_contract_id" uuid,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"contract_id" uuid NOT NULL,
	"role_title" text NOT NULL,
	"user_id" uuid,
	"contact_id" uuid,
	"free_name" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "contract_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	CONSTRAINT "contract_statuses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "contract_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "contract_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"project_id" uuid NOT NULL,
	"direction" "contract_direction" NOT NULL,
	"client_id" uuid,
	"paying_client_id" uuid,
	"supplier_id" uuid,
	"number_in_project" integer NOT NULL,
	"name" text NOT NULL,
	"order_number" text,
	"contract_type_id" uuid,
	"status_id" uuid,
	"status_manual" boolean DEFAULT false NOT NULL,
	"signed_date" date,
	"opening_date" date,
	"target_date" date,
	"actual_end_date" date,
	"description" text,
	"currency" char(3) DEFAULT 'ILS' NOT NULL,
	"index_linked" boolean DEFAULT false NOT NULL,
	"index_base_month" date,
	"index_floor" boolean DEFAULT false NOT NULL,
	"participates_in_hours" boolean DEFAULT true NOT NULL,
	"retention_pct" numeric(5, 2),
	"budget_amount" numeric(12, 2),
	"is_locked" boolean DEFAULT false NOT NULL,
	"notes" text,
	CONSTRAINT "contracts_project_direction_number" UNIQUE("project_id","direction","number_in_project"),
	CONSTRAINT "contracts_party_by_direction" CHECK (("contracts"."direction" = 'income' and "contracts"."client_id" is not null) or ("contracts"."direction" = 'expense' and "contracts"."supplier_id" is not null)),
	CONSTRAINT "contracts_index_base_when_linked" CHECK ("contracts"."index_linked" = false or "contracts"."index_base_month" is not null),
	CONSTRAINT "contracts_currency_ils" CHECK ("contracts"."currency" = 'ILS')
);
--> statement-breakpoint
CREATE TABLE "document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "document_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"entity_type" "document_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"document_type" text,
	"file_name" text NOT NULL,
	"storage_bucket" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_document_id" uuid,
	"uploaded_by" uuid,
	"backed_up_at" timestamp with time zone,
	CONSTRAINT "documents_bucket_path" UNIQUE("storage_bucket","storage_path")
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"sub_contract_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"stage_name_id" uuid,
	"name" text NOT NULL,
	"pct_of_subcontract" numeric(6, 3) NOT NULL,
	"discount_pct" numeric(5, 2),
	"opening_billed_pct" numeric(6, 3) DEFAULT '0' NOT NULL,
	"opening_paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"expected_date" date,
	"notes" text,
	CONSTRAINT "milestones_pct_range" CHECK ("milestones"."pct_of_subcontract" >= 0 and "milestones"."pct_of_subcontract" <= 100),
	CONSTRAINT "milestones_opening_pct_range" CHECK ("milestones"."opening_billed_pct" >= 0 and "milestones"."opening_billed_pct" <= 100)
);
--> statement-breakpoint
CREATE TABLE "project_cost_estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"sub_contract_id" uuid NOT NULL,
	"estimate_type" "estimate_type" DEFAULT 'initial' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"work_number" text NOT NULL,
	"name" text NOT NULL,
	"client_id" uuid NOT NULL,
	"paying_client_id" uuid,
	"project_manager_user_id" uuid,
	"department_id" uuid,
	"status_id" uuid,
	"status_manual" boolean DEFAULT false NOT NULL,
	"description" text,
	"start_date" date,
	"target_date" date,
	"actual_end_date" date,
	"notes" text,
	CONSTRAINT "projects_work_number_unique" UNIQUE("work_number")
);
--> statement-breakpoint
CREATE TABLE "stage_names" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stage_names_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "stage_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"template_id" uuid NOT NULL,
	"stage_name_id" uuid NOT NULL,
	"default_pct" numeric(6, 3) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "stage_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sub_contract_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"sub_contract_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "sub_contract_assignments_sc_user" UNIQUE("sub_contract_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sub_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"contract_id" uuid NOT NULL,
	"number_in_contract" integer NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"status_id" uuid,
	"opening_date" date,
	"department_id" uuid,
	"pricing_method" "pricing_method" NOT NULL,
	"base_price" numeric(12, 2),
	"discount_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"hourly_mode" "hourly_mode",
	"custom_hourly_rate" numeric(10, 2),
	"hours_cap" numeric(10, 2),
	"amount_cap" numeric(12, 2),
	"monthly_amount" numeric(12, 2),
	"retainer_start" date,
	"retainer_end" date,
	"retainer_billing_day" integer,
	"fee_pct" numeric(6, 3),
	"unit_type_id" uuid,
	"unit_price" numeric(12, 2),
	"agreed_quantity" numeric(12, 3),
	"index_linked" boolean DEFAULT false NOT NULL,
	"index_floor" boolean DEFAULT false NOT NULL,
	"index_base_month" date,
	"participates_in_hours" boolean DEFAULT true NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"notes" text,
	CONSTRAINT "sub_contracts_contract_number" UNIQUE("contract_id","number_in_contract"),
	CONSTRAINT "sub_contracts_retainer_day" CHECK ("sub_contracts"."retainer_billing_day" is null or ("sub_contracts"."retainer_billing_day" between 1 and 28))
);
--> statement-breakpoint
CREATE TABLE "unit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "unit_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "period_unlocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"user_id" uuid NOT NULL,
	"month" date NOT NULL,
	"unlocked_by" uuid NOT NULL,
	"unlocked_until" timestamp with time zone NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"sub_contract_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"minutes" integer NOT NULL,
	"start_time" time,
	"end_time" time,
	"description" text NOT NULL,
	"reported_by_user_id" uuid NOT NULL,
	"invoice_id" uuid,
	CONSTRAINT "time_entries_minutes_range" CHECK ("time_entries"."minutes" > 0 and "time_entries"."minutes" <= 1440),
	CONSTRAINT "time_entries_description_len" CHECK (length(trim("time_entries"."description")) >= 3)
);
--> statement-breakpoint
CREATE TABLE "index_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"month" date NOT NULL,
	"value" numeric(10, 4) NOT NULL,
	"source" "index_source" DEFAULT 'manual' NOT NULL,
	"fetched_at" timestamp with time zone,
	"entered_by" uuid,
	CONSTRAINT "index_values_month_unique" UNIQUE("month")
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"invoice_id" uuid NOT NULL,
	"sub_contract_id" uuid NOT NULL,
	"milestone_id" uuid,
	"line_type" "invoice_line_type" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"description" text,
	"stage_pct" numeric(6, 3),
	"stage_amount" numeric(12, 2),
	"progress_pct_this" numeric(6, 3),
	"cumulative_pct" numeric(6, 3),
	"amount_this" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cumulative_amount" numeric(12, 2),
	"grade_id" uuid,
	"user_id" uuid,
	"hours" numeric(10, 2),
	"hourly_rate" numeric(10, 2),
	"quantity" numeric(12, 3),
	"unit_price" numeric(12, 2),
	"cumulative_quantity" numeric(12, 3),
	"retainer_month" date
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"invoice_number" text NOT NULL,
	"sequence_no" integer NOT NULL,
	"sequence_year" integer,
	"invoice_kind" "invoice_kind" DEFAULT 'proforma' NOT NULL,
	"credit_of_invoice_id" uuid,
	"contract_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"paying_client_id" uuid,
	"partial_number" integer NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"period_from" date,
	"period_to" date,
	"subject" text,
	"intro_text" text,
	"notes" text,
	"index_linked" boolean DEFAULT false NOT NULL,
	"index_floor" boolean DEFAULT false NOT NULL,
	"index_base_month" date,
	"index_base_value" numeric(10, 4),
	"index_month" date,
	"index_current_value" numeric(10, 4),
	"index_ratio" numeric(12, 6) DEFAULT '1' NOT NULL,
	"cumulative_base" numeric(12, 2) DEFAULT '0' NOT NULL,
	"receipts_base" numeric(12, 2) DEFAULT '0' NOT NULL,
	"open_base" numeric(12, 2) DEFAULT '0' NOT NULL,
	"subtotal_base" numeric(12, 2) DEFAULT '0' NOT NULL,
	"index_diff" numeric(12, 2) DEFAULT '0' NOT NULL,
	"retention_pct" numeric(5, 2),
	"retention_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"before_vat" numeric(12, 2) DEFAULT '0' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"vat_exempt" boolean DEFAULT false NOT NULL,
	"vat_exempt_reason" text,
	"vat_override_reason" text,
	"vat_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"withholding_pct" numeric(5, 2),
	"expected_receipt" numeric(12, 2),
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"signed_by" uuid,
	"signed_at" timestamp with time zone,
	"signature_title_snapshot" text,
	"sent_at" timestamp with time zone,
	"sent_to" jsonb,
	"pdf_document_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancel_reason" text,
	"accounting_exported_at" timestamp with time zone,
	"accounting_export_batch_id" uuid,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "invoices_sequence" UNIQUE("sequence_year","sequence_no")
);
--> statement-breakpoint
CREATE TABLE "receipt_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"receipt_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancel_reason" text
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"client_id" uuid NOT NULL,
	"receipt_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" "receipt_method" DEFAULT 'transfer' NOT NULL,
	"reference" text,
	"notes" text,
	"accounting_exported_at" timestamp with time zone,
	"accounting_export_batch_id" uuid,
	CONSTRAINT "receipts_amount_positive" CHECK ("receipts"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "supplier_invoice_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"supplier_invoice_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"comment" text,
	CONSTRAINT "supplier_invoice_approvals_unique" UNIQUE("supplier_invoice_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"contract_id" uuid NOT NULL,
	"supplier_invoice_number" text NOT NULL,
	"invoice_date" date NOT NULL,
	"received_date" date,
	"amount_before_vat" numeric(12, 2) NOT NULL,
	"vat_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"description" text,
	"progress_pct_claimed" numeric(6, 3),
	"status" "supplier_invoice_status" DEFAULT 'pending' NOT NULL,
	"paid_date" date,
	"notes" text,
	"file_document_id" uuid
);
--> statement-breakpoint
CREATE TABLE "vat_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"rate" numeric(5, 2) NOT NULL,
	"effective_from" date NOT NULL,
	CONSTRAINT "vat_rates_effective_from_unique" UNIQUE("effective_from")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"record_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"request_id" text
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resend_message_id" text,
	"to_addresses" jsonb NOT NULL,
	"cc_addresses" jsonb,
	"subject" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" uuid,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"entity" text NOT NULL,
	"file_document_id" uuid,
	"status" "import_status" DEFAULT 'validating' NOT NULL,
	"rows_total" integer DEFAULT 0 NOT NULL,
	"rows_ok" integer DEFAULT 0 NOT NULL,
	"rows_failed" integer DEFAULT 0 NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_record_ids" jsonb,
	"run_by" uuid
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"dedupe_key" text,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"template_id" uuid NOT NULL,
	"frequency" "schedule_frequency" NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"hour" integer DEFAULT 7 NOT NULL,
	"recipients" jsonb NOT NULL,
	"format" "export_format" DEFAULT 'xlsx' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"config" jsonb NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_rates" ADD CONSTRAINT "billing_rates_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_rates" ADD CONSTRAINT "billing_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_cost_rates" ADD CONSTRAINT "employee_cost_rates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_cost_rates" ADD CONSTRAINT "employee_cost_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_notes" ADD CONSTRAINT "contract_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_notes" ADD CONSTRAINT "contract_notes_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_notes" ADD CONSTRAINT "contract_notes_sub_contract_id_sub_contracts_id_fk" FOREIGN KEY ("sub_contract_id") REFERENCES "public"."sub_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_notes" ADD CONSTRAINT "contract_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_roles" ADD CONSTRAINT "contract_roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_roles" ADD CONSTRAINT "contract_roles_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_roles" ADD CONSTRAINT "contract_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_roles" ADD CONSTRAINT "contract_roles_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_statuses" ADD CONSTRAINT "contract_statuses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_types" ADD CONSTRAINT "contract_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_paying_client_id_clients_id_fk" FOREIGN KEY ("paying_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_contract_type_id_contract_types_id_fk" FOREIGN KEY ("contract_type_id") REFERENCES "public"."contract_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_status_id_contract_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."contract_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_supersedes_document_id_documents_id_fk" FOREIGN KEY ("supersedes_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_sub_contract_id_sub_contracts_id_fk" FOREIGN KEY ("sub_contract_id") REFERENCES "public"."sub_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_stage_name_id_stage_names_id_fk" FOREIGN KEY ("stage_name_id") REFERENCES "public"."stage_names"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_estimates" ADD CONSTRAINT "project_cost_estimates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cost_estimates" ADD CONSTRAINT "project_cost_estimates_sub_contract_id_sub_contracts_id_fk" FOREIGN KEY ("sub_contract_id") REFERENCES "public"."sub_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_paying_client_id_clients_id_fk" FOREIGN KEY ("paying_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_manager_user_id_users_id_fk" FOREIGN KEY ("project_manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_status_id_contract_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."contract_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_names" ADD CONSTRAINT "stage_names_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_template_items" ADD CONSTRAINT "stage_template_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_template_items" ADD CONSTRAINT "stage_template_items_template_id_stage_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."stage_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_template_items" ADD CONSTRAINT "stage_template_items_stage_name_id_stage_names_id_fk" FOREIGN KEY ("stage_name_id") REFERENCES "public"."stage_names"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_templates" ADD CONSTRAINT "stage_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_contract_assignments" ADD CONSTRAINT "sub_contract_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_contract_assignments" ADD CONSTRAINT "sub_contract_assignments_sub_contract_id_sub_contracts_id_fk" FOREIGN KEY ("sub_contract_id") REFERENCES "public"."sub_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_contract_assignments" ADD CONSTRAINT "sub_contract_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_contract_assignments" ADD CONSTRAINT "sub_contract_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_contracts" ADD CONSTRAINT "sub_contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_contracts" ADD CONSTRAINT "sub_contracts_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_contracts" ADD CONSTRAINT "sub_contracts_status_id_contract_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."contract_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_contracts" ADD CONSTRAINT "sub_contracts_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_contracts" ADD CONSTRAINT "sub_contracts_unit_type_id_unit_types_id_fk" FOREIGN KEY ("unit_type_id") REFERENCES "public"."unit_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_unlocks" ADD CONSTRAINT "period_unlocks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_unlocks" ADD CONSTRAINT "period_unlocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_unlocks" ADD CONSTRAINT "period_unlocks_unlocked_by_users_id_fk" FOREIGN KEY ("unlocked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_sub_contract_id_sub_contracts_id_fk" FOREIGN KEY ("sub_contract_id") REFERENCES "public"."sub_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_values" ADD CONSTRAINT "index_values_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_values" ADD CONSTRAINT "index_values_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_sub_contract_id_sub_contracts_id_fk" FOREIGN KEY ("sub_contract_id") REFERENCES "public"."sub_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_credit_of_invoice_id_invoices_id_fk" FOREIGN KEY ("credit_of_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paying_client_id_clients_id_fk" FOREIGN KEY ("paying_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_signed_by_users_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pdf_document_id_documents_id_fk" FOREIGN KEY ("pdf_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_approvals" ADD CONSTRAINT "supplier_invoice_approvals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_approvals" ADD CONSTRAINT "supplier_invoice_approvals_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_approvals" ADD CONSTRAINT "supplier_invoice_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_file_document_id_documents_id_fk" FOREIGN KEY ("file_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_rates" ADD CONSTRAINT "vat_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_file_document_id_documents_id_fk" FOREIGN KEY ("file_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_run_by_users_id_fk" FOREIGN KEY ("run_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_rates_grade_idx" ON "billing_rates" USING btree ("grade_id");--> statement-breakpoint
CREATE INDEX "employee_cost_rates_user_idx" ON "employee_cost_rates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_department_idx" ON "users" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "clients_name_idx" ON "clients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "contacts_client_idx" ON "contacts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "contacts_supplier_idx" ON "contacts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "contract_notes_contract_idx" ON "contract_notes" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_notes_sc_idx" ON "contract_notes" USING btree ("sub_contract_id");--> statement-breakpoint
CREATE INDEX "contract_roles_contract_idx" ON "contract_roles" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contracts_project_idx" ON "contracts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "contracts_client_idx" ON "contracts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "contracts_supplier_idx" ON "contracts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "contracts_status_idx" ON "contracts" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "documents_entity_idx" ON "documents" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "milestones_sc_idx" ON "milestones" USING btree ("sub_contract_id");--> statement-breakpoint
CREATE INDEX "project_cost_estimates_sc_idx" ON "project_cost_estimates" USING btree ("sub_contract_id");--> statement-breakpoint
CREATE INDEX "projects_client_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "projects_pm_idx" ON "projects" USING btree ("project_manager_user_id");--> statement-breakpoint
CREATE INDEX "projects_department_idx" ON "projects" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "projects_name_idx" ON "projects" USING btree ("name");--> statement-breakpoint
CREATE INDEX "stage_template_items_template_idx" ON "stage_template_items" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "sub_contract_assignments_user_idx" ON "sub_contract_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sub_contracts_contract_idx" ON "sub_contracts" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "sub_contracts_status_idx" ON "sub_contracts" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "sub_contracts_department_idx" ON "sub_contracts" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "period_unlocks_user_month_idx" ON "period_unlocks" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "time_entries_user_date_idx" ON "time_entries" USING btree ("user_id","work_date");--> statement-breakpoint
CREATE INDEX "time_entries_sc_date_idx" ON "time_entries" USING btree ("sub_contract_id","work_date");--> statement-breakpoint
CREATE INDEX "time_entries_invoice_idx" ON "time_entries" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_sc_idx" ON "invoice_lines" USING btree ("sub_contract_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_milestone_idx" ON "invoice_lines" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "invoices_contract_idx" ON "invoices" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_date_idx" ON "invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "receipt_allocations_receipt_idx" ON "receipt_allocations" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "receipt_allocations_invoice_idx" ON "receipt_allocations" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "receipts_client_idx" ON "receipts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "receipts_date_idx" ON "receipts" USING btree ("receipt_date");--> statement-breakpoint
CREATE INDEX "supplier_invoices_contract_idx" ON "supplier_invoices" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "supplier_invoices_status_idx" ON "supplier_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_log_record_idx" ON "audit_log" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("changed_by","changed_at");--> statement-breakpoint
CREATE INDEX "email_log_resend_idx" ON "email_log" USING btree ("resend_message_id");--> statement-breakpoint
CREATE INDEX "email_log_entity_idx" ON "email_log" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notifications_dedupe_idx" ON "notifications" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "report_schedules_next_idx" ON "report_schedules" USING btree ("is_active","next_run_at");--> statement-breakpoint
CREATE INDEX "report_templates_owner_idx" ON "report_templates" USING btree ("owner_user_id");
-- ============ 2. טריגרים, audit ו-RLS (drizzle/0001_triggers_rls.sql) ============
-- ============================================================================
-- PGL-R: audit triggers, updated_at triggers, append-only audit log, RLS deny-all
-- (spec §2.2, §14, §17)
-- ============================================================================

-- ---------------------------------------------------------------- updated_at
CREATE OR REPLACE FUNCTION app_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------- audit
-- The acting user is passed by the application with:  SET LOCAL app.user_id = '<uuid>'
-- and an optional request id with:                    SET LOCAL app.request_id = '<id>'
CREATE OR REPLACE FUNCTION app_audit_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user uuid;
  v_req  text;
  v_before jsonb;
  v_after  jsonb;
  v_record uuid;
BEGIN
  BEGIN
    v_user := nullif(current_setting('app.user_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v_user := NULL;
  END;
  v_req := nullif(current_setting('app.request_id', true), '');

  IF TG_OP = 'INSERT' THEN
    v_after := to_jsonb(NEW);
    v_record := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_record := NEW.id;
    -- ignore no-op updates (only updated_at changed)
    IF (v_before - 'updated_at') = (v_after - 'updated_at') THEN
      RETURN NEW;
    END IF;
  ELSE
    v_before := to_jsonb(OLD);
    v_record := OLD.id;
  END IF;

  INSERT INTO audit_log (table_name, record_id, action, changed_by, changed_at, before, after, request_id)
  VALUES (TG_TABLE_NAME, v_record, lower(TG_OP)::audit_action, v_user, now(), v_before, v_after, v_req);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

-- Reason for sensitive actions is stored by the app inside after.__reason via
-- SET LOCAL app.reason – merged here so that it lands in the audit row.
CREATE OR REPLACE FUNCTION app_audit_reason() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.reason', true), '') $$;

-- Tables that carry a uuid "id" column and are audited (spec §14: everything in §5
-- except notifications, email_log, audit_log; settings uses key PK → separate trigger).
DO $$
DECLARE
  t text;
  audited text[] := ARRAY[
    'departments','grades','users','employee_cost_rates','billing_rates',
    'clients','suppliers','contacts',
    'contract_statuses','contract_types','unit_types','stage_names','stage_templates','stage_template_items','document_types',
    'projects','contracts','sub_contracts','project_cost_estimates','milestones','contract_roles','contract_notes','documents','sub_contract_assignments',
    'time_entries','period_unlocks',
    'index_values','vat_rates','invoices','invoice_lines','receipts','receipt_allocations','supplier_invoices','supplier_invoice_approvals',
    'report_templates','report_schedules','import_batches'
  ];
BEGIN
  FOREACH t IN ARRAY audited LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION app_audit_trigger()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION app_set_updated_at()', t);
  END LOOP;
END $$;

-- report_schedules: last_run_at / next_run_at churn is excluded from audit (spec §14)
DROP TRIGGER IF EXISTS trg_audit ON report_schedules;
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE OF template_id, frequency, day_of_week, day_of_month, hour, recipients, format, is_active
  ON report_schedules FOR EACH ROW EXECUTE FUNCTION app_audit_trigger();

-- deterministic uuid for a settings key
CREATE OR REPLACE FUNCTION uuid_generate_v5_key(k text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$ SELECT md5('settings:' || k)::uuid $$;

-- settings (text PK) audit
CREATE OR REPLACE FUNCTION app_audit_settings_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user uuid;
BEGIN
  BEGIN v_user := nullif(current_setting('app.user_id', true), '')::uuid; EXCEPTION WHEN others THEN v_user := NULL; END;
  INSERT INTO audit_log (table_name, record_id, action, changed_by, changed_at, before, after, request_id)
  VALUES ('settings', uuid_generate_v5_key(COALESCE(NEW.key, OLD.key)), lower(TG_OP)::audit_action, v_user, now(),
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
          nullif(current_setting('app.request_id', true), ''));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit ON settings;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON settings FOR EACH ROW EXECUTE FUNCTION app_audit_settings_trigger();
DROP TRIGGER IF EXISTS trg_updated_at ON settings;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION app_set_updated_at();
DROP TRIGGER IF EXISTS trg_updated_at ON email_log;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON email_log FOR EACH ROW EXECUTE FUNCTION app_set_updated_at();

-- ---------------------------------------------------------------- append-only audit log
CREATE OR REPLACE FUNCTION app_audit_log_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END $$;
DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION app_audit_log_immutable();

-- ---------------------------------------------------------------- RLS deny-all (anon / authenticated)
-- All data access is server-side with the service role, which bypasses RLS.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS deny_all ON %I', r.tablename);
    EXECUTE format('CREATE POLICY deny_all ON %I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', r.tablename);
  END LOOP;
EXCEPTION WHEN undefined_object THEN
  -- roles anon/authenticated do not exist outside Supabase (e.g. local Postgres) – RLS is still enabled
  NULL;
END $$;

-- ---------------------------------------------------------------- helper views for balances (spec §17: SQL aggregation)
CREATE OR REPLACE VIEW v_invoice_lines_counted AS
  SELECT il.*, i.status AS invoice_status, i.invoice_kind, i.contract_id,
         CASE WHEN i.invoice_kind = 'credit' THEN -1 ELSE 1 END AS sign
  FROM invoice_lines il
  JOIN invoices i ON i.id = il.invoice_id
  WHERE i.status IN ('approved','signed','sent','partially_paid','paid') AND i.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_sub_contract_hours AS
  SELECT sub_contract_id,
         round(sum(minutes)::numeric / 60, 2) AS hours_total,
         round(sum(CASE WHEN date_trunc('year', work_date) = date_trunc('year', (now() AT TIME ZONE 'Asia/Jerusalem')) THEN minutes ELSE 0 END)::numeric / 60, 2) AS hours_this_year
  FROM time_entries
  WHERE deleted_at IS NULL
  GROUP BY sub_contract_id;

-- ============ 3. נתוני בסיס (pnpm db:seed) ============
INSERT INTO public.contract_statuses (id, created_at, updated_at, created_by, name, code, is_active, sort_order, is_terminal) VALUES ('b5feca50-0043-4bbc-b852-74f7818d12a1', '2026-09-13 19:46:19.897446+00', '2026-09-13 19:46:19.897446+00', NULL, 'טיוטה', 'draft', true, 1, false) ON CONFLICT DO NOTHING;
INSERT INTO public.contract_statuses (id, created_at, updated_at, created_by, name, code, is_active, sort_order, is_terminal) VALUES ('7e276c8c-8933-4719-89e0-300df742ba3a', '2026-09-13 19:46:19.899658+00', '2026-09-13 19:46:19.899658+00', NULL, 'בעבודה', 'active', true, 2, false) ON CONFLICT DO NOTHING;
INSERT INTO public.contract_statuses (id, created_at, updated_at, created_by, name, code, is_active, sort_order, is_terminal) VALUES ('6976d3f9-2d8e-4bbb-bfb3-0cf18f566204', '2026-09-13 19:46:19.901349+00', '2026-09-13 19:46:19.901349+00', NULL, 'מוקפא', 'on_hold', true, 3, false) ON CONFLICT DO NOTHING;
INSERT INTO public.contract_statuses (id, created_at, updated_at, created_by, name, code, is_active, sort_order, is_terminal) VALUES ('a7efc59e-953e-494f-9bf1-f82e1be6a772', '2026-09-13 19:46:19.902777+00', '2026-09-13 19:46:19.902777+00', NULL, 'הסתיים', 'completed', true, 4, true) ON CONFLICT DO NOTHING;
INSERT INTO public.contract_statuses (id, created_at, updated_at, created_by, name, code, is_active, sort_order, is_terminal) VALUES ('e57bd326-9598-497f-9ced-d75a8014edaf', '2026-09-13 19:46:19.903968+00', '2026-09-13 19:46:19.903968+00', NULL, 'מבוטל', 'cancelled', true, 5, true) ON CONFLICT DO NOTHING;
INSERT INTO public.contract_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('8d7b5504-88b4-450d-837c-a317b8eb9983', '2026-09-13 19:46:19.905316+00', '2026-09-13 19:46:19.905316+00', NULL, 'פיקס פרייס', 'fixed_price', true, 1) ON CONFLICT DO NOTHING;
INSERT INTO public.contract_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('659b9d4a-013b-4be6-a7dc-299356450e87', '2026-09-13 19:46:19.90707+00', '2026-09-13 19:46:19.90707+00', NULL, 'לפי שעות', 'hourly', true, 2) ON CONFLICT DO NOTHING;
INSERT INTO public.contract_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('c3019cfd-0598-4b01-ac6a-3d741cf94f44', '2026-09-13 19:46:19.908295+00', '2026-09-13 19:46:19.908295+00', NULL, 'ריטיינר', 'retainer', true, 3) ON CONFLICT DO NOTHING;
INSERT INTO public.contract_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('ff9f2046-3a17-4d87-a17e-36814e3ac46d', '2026-09-13 19:46:19.909279+00', '2026-09-13 19:46:19.909279+00', NULL, 'אחוז מעלות פרויקט', 'pct_of_cost', true, 4) ON CONFLICT DO NOTHING;
INSERT INTO public.contract_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('aa3fba0d-3ad1-4d3b-8873-fdc2bbcf21ea', '2026-09-13 19:46:19.910279+00', '2026-09-13 19:46:19.910279+00', NULL, 'לפי יחידות', 'per_unit', true, 5) ON CONFLICT DO NOTHING;
INSERT INTO public.contract_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('a757a1e2-5d8b-4ecc-a9b9-af14f4cb2e7a', '2026-09-13 19:46:19.911271+00', '2026-09-13 19:46:19.911271+00', NULL, 'מעורב', 'mixed', true, 6) ON CONFLICT DO NOTHING;
INSERT INTO public.departments (id, name, code, manager_user_id, is_active, sort_order, created_at, updated_at, created_by) VALUES ('2f182556-ed30-4ca4-a4a0-348e8e6ac9ca', 'מחלקה 1', 'D1', NULL, true, 1, '2026-09-13 19:46:19.884949+00', '2026-09-13 19:46:19.884949+00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.departments (id, name, code, manager_user_id, is_active, sort_order, created_at, updated_at, created_by) VALUES ('d6a5618d-e87e-4586-a802-b4275c6bcc75', 'מחלקה 2', 'D2', NULL, true, 2, '2026-09-13 19:46:19.889934+00', '2026-09-13 19:46:19.889934+00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.departments (id, name, code, manager_user_id, is_active, sort_order, created_at, updated_at, created_by) VALUES ('b724458e-e0a9-4c69-a2f9-e55b7e03a846', 'מחלקה 3', 'D3', NULL, true, 3, '2026-09-13 19:46:19.891757+00', '2026-09-13 19:46:19.891757+00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.departments (id, name, code, manager_user_id, is_active, sort_order, created_at, updated_at, created_by) VALUES ('389597c9-d4d5-41fa-af44-bba065f19485', 'מחלקה 4', 'D4', NULL, true, 4, '2026-09-13 19:46:19.893449+00', '2026-09-13 19:46:19.893449+00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.departments (id, name, code, manager_user_id, is_active, sort_order, created_at, updated_at, created_by) VALUES ('33374103-5c78-4a11-aa49-d4df7ba9dc1d', 'מחלקה 5', 'D5', NULL, true, 5, '2026-09-13 19:46:19.894814+00', '2026-09-13 19:46:19.894814+00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.departments (id, name, code, manager_user_id, is_active, sort_order, created_at, updated_at, created_by) VALUES ('1b92b9cf-a00a-447d-8d40-0094d24a2594', 'מחלקה 6', 'D6', NULL, true, 6, '2026-09-13 19:46:19.89612+00', '2026-09-13 19:46:19.89612+00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.document_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('7540e554-9cc8-4e1d-a2a7-7e84950ced59', '2026-09-13 19:46:19.917105+00', '2026-09-13 19:46:19.917105+00', NULL, 'חוזה חתום', 'signed_contract', true, 1) ON CONFLICT DO NOTHING;
INSERT INTO public.document_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('0207ba7d-3103-47d8-a102-7e19b95ba22d', '2026-09-13 19:46:19.918789+00', '2026-09-13 19:46:19.918789+00', NULL, 'הזמנת עבודה', 'work_order', true, 2) ON CONFLICT DO NOTHING;
INSERT INTO public.document_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('07c68cf3-02f9-4d90-a1e4-9fe6258c41db', '2026-09-13 19:46:19.919918+00', '2026-09-13 19:46:19.919918+00', NULL, 'תכתובת', 'correspondence', true, 3) ON CONFLICT DO NOTHING;
INSERT INTO public.document_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('e7ed39aa-de4a-4a25-90c9-2400f29b7fbe', '2026-09-13 19:46:19.920941+00', '2026-09-13 19:46:19.920941+00', NULL, 'חשבונית', 'invoice', true, 4) ON CONFLICT DO NOTHING;
INSERT INTO public.document_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('e993df7c-1da1-4c0b-a538-1fcc7be254ad', '2026-09-13 19:46:19.92186+00', '2026-09-13 19:46:19.92186+00', NULL, 'אחר', 'other', true, 99) ON CONFLICT DO NOTHING;
INSERT INTO public.grades (id, name, is_active, sort_order, created_at, updated_at, created_by) VALUES ('3b2ad672-c816-43e4-a53e-f07706abe69b', 'מהנדס בכיר', true, 1, '2026-09-13 19:46:19.956886+00', '2026-09-13 19:46:19.956886+00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.grades (id, name, is_active, sort_order, created_at, updated_at, created_by) VALUES ('d2f3bec6-02e0-4350-82b8-4d982ea80529', 'מהנדס', true, 2, '2026-09-13 19:46:19.956886+00', '2026-09-13 19:46:19.956886+00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.grades (id, name, is_active, sort_order, created_at, updated_at, created_by) VALUES ('3b98298b-a182-4ccb-bcf3-e2a167b91a37', 'הנדסאי', true, 3, '2026-09-13 19:46:19.956886+00', '2026-09-13 19:46:19.956886+00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.grades (id, name, is_active, sort_order, created_at, updated_at, created_by) VALUES ('d533f2b2-d60f-49be-a5f2-95c1c41de292', 'שרטט', true, 4, '2026-09-13 19:46:19.956886+00', '2026-09-13 19:46:19.956886+00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('c1c668e9-7eb0-46ac-b9d5-c72592a9b311', '2026-09-13 19:46:19.922843+00', '2026-09-13 19:46:19.922843+00', NULL, 'לימוד מצב קיים', true, 1) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('24e804b7-517d-4302-ad15-f5ac07fc5bbf', '2026-09-13 19:46:19.924499+00', '2026-09-13 19:46:19.924499+00', NULL, 'הכנת חלופות', true, 2) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('1cb0eeae-5e92-4475-b640-7d663ab54850', '2026-09-13 19:46:19.925716+00', '2026-09-13 19:46:19.925716+00', NULL, 'בחירה ועיבוד חלופה', true, 3) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('199f3410-4250-41f0-9b5b-700ad1450504', '2026-09-13 19:46:19.926675+00', '2026-09-13 19:46:19.926675+00', NULL, 'עיבוד החלופה הנבחרת', true, 4) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('c1f3f033-cfcb-4db8-beb8-5d0cc2b19197', '2026-09-13 19:46:19.927739+00', '2026-09-13 19:46:19.927739+00', NULL, 'הגשה לוועדות', true, 5) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('0393d990-4606-4dd7-9532-f8c62d5e2ce2', '2026-09-13 19:46:19.928736+00', '2026-09-13 19:46:19.928736+00', NULL, 'הפקדה', true, 6) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('44463887-b4e8-4187-855d-58c8f0dfd9bb', '2026-09-13 19:46:19.929704+00', '2026-09-13 19:46:19.929704+00', NULL, 'התנגדויות', true, 7) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('f287e1b8-a95d-41e9-9347-2f1f2bede9c1', '2026-09-13 19:46:19.930584+00', '2026-09-13 19:46:19.930584+00', NULL, 'מתן תוקף', true, 8) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('7ea29a0b-d1c4-4ed2-a358-e2a9d42032f9', '2026-09-13 19:46:19.931478+00', '2026-09-13 19:46:19.931478+00', NULL, 'עיבוד אישור רשויות', true, 9) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('eaffd3dc-6add-44ea-9915-aaa2400ca18f', '2026-09-13 19:46:19.932479+00', '2026-09-13 19:46:19.932479+00', NULL, 'הכנת תכנית עבודה', true, 10) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('477915ed-3969-4f4d-bc7d-d4456a52a070', '2026-09-13 19:46:19.933351+00', '2026-09-13 19:46:19.933351+00', NULL, 'פיקוח עליון', true, 11) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('98f1eeef-cd1b-43ba-b5b3-fb7fe15128ff', '2026-09-13 19:46:19.934206+00', '2026-09-13 19:46:19.934206+00', NULL, 'תכנון מוקדם', true, 12) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('d8c68cd1-bc2f-44cf-92b3-f87c0b1d82bc', '2026-09-13 19:46:19.935111+00', '2026-09-13 19:46:19.935111+00', NULL, 'תכנון סופי', true, 13) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('28371c98-3a97-4d87-adc5-602a2ef7c86f', '2026-09-13 19:46:19.936061+00', '2026-09-13 19:46:19.936061+00', NULL, 'נספח תנועה', true, 14) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('7bc47c5c-3e86-4e2f-bfb9-ac70cf41e7e3', '2026-09-13 19:46:19.937083+00', '2026-09-13 19:46:19.937083+00', NULL, 'השלמת תכנון מוקדם', true, 15) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('3095874a-3df5-487b-b441-17ac608bd899', '2026-09-13 19:46:19.938047+00', '2026-09-13 19:46:19.938047+00', NULL, 'השלמת תכנון סופי', true, 16) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('3bdeeb7b-4625-4423-b86e-6f8300651b37', '2026-09-13 19:46:19.938992+00', '2026-09-13 19:46:19.938992+00', NULL, 'אישור נספח תנועה להיתר', true, 17) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_names (id, created_at, updated_at, created_by, name, is_active, sort_order) VALUES ('605caf2f-199e-426f-9cee-b96ef3b3657d', '2026-09-13 19:46:19.939885+00', '2026-09-13 19:46:19.939885+00', NULL, 'הכנת תכניות עבודה לביצוע', true, 18) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_templates (id, created_at, updated_at, created_by, name, is_active) VALUES ('094b31e7-8e2a-4ca3-8b5c-d7ec2adebfe1', '2026-09-13 19:46:19.944993+00', '2026-09-13 19:46:19.944993+00', NULL, 'תב"ע', true) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_templates (id, created_at, updated_at, created_by, name, is_active) VALUES ('79301b5d-96e3-46ca-96c3-025964945f4b', '2026-09-13 19:46:19.951058+00', '2026-09-13 19:46:19.951058+00', NULL, 'תכנון מפורט', true) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_template_items (id, created_at, updated_at, created_by, template_id, stage_name_id, default_pct, sort_order) VALUES ('348c05ce-a534-4aad-93d6-535fe0eaae38', '2026-09-13 19:46:19.947207+00', '2026-09-13 19:46:19.947207+00', NULL, '094b31e7-8e2a-4ca3-8b5c-d7ec2adebfe1', 'c1c668e9-7eb0-46ac-b9d5-c72592a9b311', 10.000, 1) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_template_items (id, created_at, updated_at, created_by, template_id, stage_name_id, default_pct, sort_order) VALUES ('1152a6e6-9158-472a-982f-18775e5d4d5b', '2026-09-13 19:46:19.947207+00', '2026-09-13 19:46:19.947207+00', NULL, '094b31e7-8e2a-4ca3-8b5c-d7ec2adebfe1', '24e804b7-517d-4302-ad15-f5ac07fc5bbf', 15.000, 2) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_template_items (id, created_at, updated_at, created_by, template_id, stage_name_id, default_pct, sort_order) VALUES ('65188919-e798-449b-900c-0f1ac2566940', '2026-09-13 19:46:19.947207+00', '2026-09-13 19:46:19.947207+00', NULL, '094b31e7-8e2a-4ca3-8b5c-d7ec2adebfe1', '1cb0eeae-5e92-4475-b640-7d663ab54850', 25.000, 3) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_template_items (id, created_at, updated_at, created_by, template_id, stage_name_id, default_pct, sort_order) VALUES ('b78f8daa-4ca5-4c77-9d79-a409912e46c1', '2026-09-13 19:46:19.947207+00', '2026-09-13 19:46:19.947207+00', NULL, '094b31e7-8e2a-4ca3-8b5c-d7ec2adebfe1', 'c1f3f033-cfcb-4db8-beb8-5d0cc2b19197', 15.000, 4) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_template_items (id, created_at, updated_at, created_by, template_id, stage_name_id, default_pct, sort_order) VALUES ('45918ec2-30c8-4c91-b42e-03a2dd413452', '2026-09-13 19:46:19.947207+00', '2026-09-13 19:46:19.947207+00', NULL, '094b31e7-8e2a-4ca3-8b5c-d7ec2adebfe1', '0393d990-4606-4dd7-9532-f8c62d5e2ce2', 10.000, 5) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_template_items (id, created_at, updated_at, created_by, template_id, stage_name_id, default_pct, sort_order) VALUES ('b211d098-a648-4791-bfde-c65a93fcb365', '2026-09-13 19:46:19.947207+00', '2026-09-13 19:46:19.947207+00', NULL, '094b31e7-8e2a-4ca3-8b5c-d7ec2adebfe1', '44463887-b4e8-4187-855d-58c8f0dfd9bb', 15.000, 6) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_template_items (id, created_at, updated_at, created_by, template_id, stage_name_id, default_pct, sort_order) VALUES ('bb3692cf-d925-4b37-b705-33b473fb8342', '2026-09-13 19:46:19.947207+00', '2026-09-13 19:46:19.947207+00', NULL, '094b31e7-8e2a-4ca3-8b5c-d7ec2adebfe1', 'f287e1b8-a95d-41e9-9347-2f1f2bede9c1', 10.000, 7) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_template_items (id, created_at, updated_at, created_by, template_id, stage_name_id, default_pct, sort_order) VALUES ('31e55500-23fe-4e6a-b5c5-97d8dc016f61', '2026-09-13 19:46:19.95233+00', '2026-09-13 19:46:19.95233+00', NULL, '79301b5d-96e3-46ca-96c3-025964945f4b', '7bc47c5c-3e86-4e2f-bfb9-ac70cf41e7e3', 15.000, 1) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_template_items (id, created_at, updated_at, created_by, template_id, stage_name_id, default_pct, sort_order) VALUES ('8d165d8e-af48-4441-944b-e65d551e3424', '2026-09-13 19:46:19.95233+00', '2026-09-13 19:46:19.95233+00', NULL, '79301b5d-96e3-46ca-96c3-025964945f4b', '3095874a-3df5-487b-b441-17ac608bd899', 20.000, 2) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_template_items (id, created_at, updated_at, created_by, template_id, stage_name_id, default_pct, sort_order) VALUES ('8a9c8600-1ca9-473e-bd1f-e426db1bea54', '2026-09-13 19:46:19.95233+00', '2026-09-13 19:46:19.95233+00', NULL, '79301b5d-96e3-46ca-96c3-025964945f4b', '3bdeeb7b-4625-4423-b86e-6f8300651b37', 25.000, 3) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_template_items (id, created_at, updated_at, created_by, template_id, stage_name_id, default_pct, sort_order) VALUES ('0bc12632-ca5d-4e15-b48e-fb950b4defa8', '2026-09-13 19:46:19.95233+00', '2026-09-13 19:46:19.95233+00', NULL, '79301b5d-96e3-46ca-96c3-025964945f4b', '605caf2f-199e-426f-9cee-b96ef3b3657d', 30.000, 4) ON CONFLICT DO NOTHING;
INSERT INTO public.stage_template_items (id, created_at, updated_at, created_by, template_id, stage_name_id, default_pct, sort_order) VALUES ('a91eee5d-6fff-48f2-8eb3-7889c6ffef35', '2026-09-13 19:46:19.95233+00', '2026-09-13 19:46:19.95233+00', NULL, '79301b5d-96e3-46ca-96c3-025964945f4b', '477915ed-3969-4f4d-bc7d-d4456a52a070', 10.000, 5) ON CONFLICT DO NOTHING;
INSERT INTO public.unit_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('310f9552-ff0f-45cc-871c-bb39ad34b704', '2026-09-13 19:46:19.912351+00', '2026-09-13 19:46:19.912351+00', NULL, 'חניה', 'parking', true, 1) ON CONFLICT DO NOTHING;
INSERT INTO public.unit_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('9ad138eb-7401-4d61-a03e-bca9c1347ddb', '2026-09-13 19:46:19.913875+00', '2026-09-13 19:46:19.913875+00', NULL, 'ק"מ', 'km', true, 2) ON CONFLICT DO NOTHING;
INSERT INTO public.unit_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('abe33fd9-9615-47e4-8fab-b2bf75b2b2f5', '2026-09-13 19:46:19.914864+00', '2026-09-13 19:46:19.914864+00', NULL, 'צומת', 'junction', true, 3) ON CONFLICT DO NOTHING;
INSERT INTO public.unit_types (id, created_at, updated_at, created_by, name, code, is_active, sort_order) VALUES ('09c9532b-4a04-475b-afe4-9a584488e843', '2026-09-13 19:46:19.915877+00', '2026-09-13 19:46:19.915877+00', NULL, 'דונם', 'dunam', true, 4) ON CONFLICT DO NOTHING;
INSERT INTO public.vat_rates (id, created_at, updated_at, created_by, rate, effective_from) VALUES ('a1695269-2119-40c1-910d-3bb8b7ab795d', '2026-09-13 19:46:19.953753+00', '2026-09-13 19:46:19.953753+00', NULL, 18.00, '2025-01-01') ON CONFLICT DO NOTHING;


-- ============ 4. תיקיות אחסון פרטיות (pnpm storage:init) ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts','contracts',false), ('invoices','invoices',false), ('supplier-invoices','supplier-invoices',false),
       ('general-docs','general-docs',false), ('signatures','signatures',false), ('company','company',false),
       ('imports','imports',false), ('report-exports','report-exports',false)
ON CONFLICT (id) DO NOTHING;

-- ============ 5. רישום המיגרציות, כדי ש-pnpm db:migrate יזהה שהן הוחלו ============
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
SELECT v.hash, v.created_at FROM (VALUES
  ('d1947a33563664b4aaee99a6b50e41273ec7b0a11903926b0c1119bc28f8f5a9', 1789328601569::bigint),
  ('e8e41b9a70b72f70e08340e59d2aca834a10218678d042847522499167714d2d', 1789328646702::bigint)
) AS v(hash, created_at)
WHERE NOT EXISTS (SELECT 1 FROM drizzle."__drizzle_migrations" WHERE hash = v.hash);

COMMIT;
