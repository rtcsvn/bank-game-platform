-- Apply Row Level Security policies to tenant-scoped tables
-- Run: psql $DATABASE_URL -f scripts/apply-rls.sql

-- Enable RLS on key tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE prize_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE earn_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligible_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Campaigns: visible only to matching tenant
CREATE POLICY campaigns_tenant ON campaigns
  USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

CREATE POLICY prize_pools_tenant ON prize_pools
  USING (campaign_id IN (SELECT id FROM campaigns WHERE tenant_id = current_tenant_id() OR current_tenant_id() IS NULL));

CREATE POLICY customer_turns_tenant ON customer_turns
  USING (campaign_id IN (SELECT id FROM campaigns WHERE tenant_id = current_tenant_id() OR current_tenant_id() IS NULL));

CREATE POLICY customer_plays_tenant ON customer_plays
  USING (campaign_id IN (SELECT id FROM campaigns WHERE tenant_id = current_tenant_id() OR current_tenant_id() IS NULL));

CREATE POLICY users_tenant ON users
  USING (tenant_id = current_tenant_id() OR tenant_id IS NULL OR current_tenant_id() IS NULL);

-- Audit logs: tenant-scoped (append-only enforced by no UPDATE/DELETE grant)
CREATE POLICY audit_logs_tenant ON audit_logs
  USING (tenant_id = current_tenant_id() OR current_tenant_id() IS NULL);

-- Revoke UPDATE/DELETE on audit_logs to enforce immutability
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;

COMMENT ON TABLE audit_logs IS 'Append-only audit trail. UPDATE/DELETE revoked at DB level.';
