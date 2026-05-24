-- Row Level Security setup for multi-tenant isolation
-- This runs once when PostgreSQL container is first initialized

-- Create app role with limited permissions
CREATE ROLE app_user LOGIN PASSWORD 'bgp_dev_secret';
GRANT CONNECT ON DATABASE bank_game_platform TO app_user;

-- Function to get current tenant from session variable
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
DECLARE
  tenant_id_text TEXT;
BEGIN
  BEGIN
    tenant_id_text := current_setting('app.tenant_id');
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  
  IF tenant_id_text IS NULL OR tenant_id_text = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN tenant_id_text::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- NOTE: RLS policies are applied after Prisma migrations run.
-- Run backend/scripts/apply-rls.sql after first migration.
