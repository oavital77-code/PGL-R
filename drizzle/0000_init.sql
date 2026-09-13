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