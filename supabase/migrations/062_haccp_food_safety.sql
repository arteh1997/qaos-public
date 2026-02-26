-- Migration 062: HACCP Food Safety Module
-- Tables for food safety compliance: templates, checks, temperature logs, corrective actions

-- ── Check Templates ──
CREATE TABLE IF NOT EXISTS haccp_check_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'shift')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_haccp_check_templates_store ON haccp_check_templates(store_id);
CREATE TRIGGER set_haccp_check_templates_updated_at
  BEFORE UPDATE ON haccp_check_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Completed Checks ──
CREATE TABLE IF NOT EXISTS haccp_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  template_id UUID REFERENCES haccp_check_templates(id) ON DELETE SET NULL,
  completed_by UUID NOT NULL REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pass' CHECK (status IN ('pass', 'fail', 'partial')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_haccp_checks_store ON haccp_checks(store_id);
CREATE INDEX idx_haccp_checks_completed_at ON haccp_checks(completed_at);
CREATE INDEX idx_haccp_checks_status ON haccp_checks(store_id, status);

-- ── Temperature Logs ──
CREATE TABLE IF NOT EXISTS haccp_temperature_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  temperature_celsius NUMERIC(5,2) NOT NULL,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_in_range BOOLEAN NOT NULL DEFAULT true,
  min_temp NUMERIC(5,2),
  max_temp NUMERIC(5,2),
  corrective_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_haccp_temp_logs_store ON haccp_temperature_logs(store_id);
CREATE INDEX idx_haccp_temp_logs_recorded_at ON haccp_temperature_logs(recorded_at);
CREATE INDEX idx_haccp_temp_logs_out_of_range ON haccp_temperature_logs(store_id) WHERE NOT is_in_range;

-- ── Corrective Actions ──
CREATE TABLE IF NOT EXISTS haccp_corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  check_id UUID REFERENCES haccp_checks(id) ON DELETE SET NULL,
  temp_log_id UUID REFERENCES haccp_temperature_logs(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  action_taken TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_haccp_corrective_actions_store ON haccp_corrective_actions(store_id);
CREATE INDEX idx_haccp_corrective_actions_unresolved ON haccp_corrective_actions(store_id) WHERE resolved_at IS NULL;

-- ── RLS Policies ──
ALTER TABLE haccp_check_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_temperature_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_corrective_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY haccp_check_templates_select ON haccp_check_templates
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));
CREATE POLICY haccp_check_templates_insert ON haccp_check_templates
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));
CREATE POLICY haccp_check_templates_update ON haccp_check_templates
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));
CREATE POLICY haccp_check_templates_delete ON haccp_check_templates
  FOR DELETE USING (store_id = ANY(get_user_store_ids()));

CREATE POLICY haccp_checks_select ON haccp_checks
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));
CREATE POLICY haccp_checks_insert ON haccp_checks
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY haccp_temp_logs_select ON haccp_temperature_logs
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));
CREATE POLICY haccp_temp_logs_insert ON haccp_temperature_logs
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));

CREATE POLICY haccp_corrective_actions_select ON haccp_corrective_actions
  FOR SELECT USING (store_id = ANY(get_user_store_ids()));
CREATE POLICY haccp_corrective_actions_insert ON haccp_corrective_actions
  FOR INSERT WITH CHECK (store_id = ANY(get_user_store_ids()));
CREATE POLICY haccp_corrective_actions_update ON haccp_corrective_actions
  FOR UPDATE USING (store_id = ANY(get_user_store_ids()));

COMMENT ON TABLE haccp_check_templates IS 'Predefined safety checklist templates for HACCP compliance';
COMMENT ON TABLE haccp_checks IS 'Completed HACCP checklist instances';
COMMENT ON TABLE haccp_temperature_logs IS 'Temperature readings for food safety monitoring';
COMMENT ON TABLE haccp_corrective_actions IS 'Corrective actions when safety checks fail';
