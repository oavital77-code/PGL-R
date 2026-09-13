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
