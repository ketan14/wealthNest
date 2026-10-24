#!/usr/bin/env bash
# ==============================================================================
# WealthNest Platform Administration Bootstrap Script
# Safely grants super_admin role to a designated user and initializes audit log
# ==============================================================================

set -euo pipefail

ADMIN_EMAIL="${1:-investor@wealthnest.local}"
CONTAINER_NAME="supabase_db_wealthnest"

echo "=================================================="
echo " WealthNest Platform Administrator Bootstrap"
echo "=================================================="
echo "Target Administrator: ${ADMIN_EMAIL}"

# Check Docker container availability
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Using Docker container: ${CONTAINER_NAME}"
  EXEC_CMD="docker exec -i ${CONTAINER_NAME} psql -U postgres -d postgres"
elif [ -n "${DATABASE_URL:-}" ]; then
  echo "Using DATABASE_URL"
  EXEC_CMD="psql ${DATABASE_URL}"
else
  echo "Error: Neither docker container ${CONTAINER_NAME} nor DATABASE_URL found."
  exit 1
fi

SQL_PAYLOAD=$(cat <<EOF
DO \$\$
DECLARE
  v_user_id uuid;
  v_household_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- Lookup target user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = '${ADMIN_EMAIL}'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user "%" not found in auth.users. User must sign up or be created first.', '${ADMIN_EMAIL}';
  END IF;

  -- Ensure user_access_status is active
  INSERT INTO public.user_access_status (user_id, status, reason_code, reason_details)
  VALUES (v_user_id, 'active', 'MANUAL_BOOTSTRAP', 'Initial system administrator promotion')
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    updated_at = now();

  -- Grant super_admin platform role
  INSERT INTO public.platform_admin_roles (user_id, role, is_active, granted_at)
  VALUES (v_user_id, 'super_admin', true, now())
  ON CONFLICT DO NOTHING;

  -- Ensure Vaghela Household exists
  INSERT INTO public.households (id, name, created_by)
  VALUES (v_household_id, 'Vaghela Household', v_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- Ensure primary_owner membership
  INSERT INTO public.household_members (household_id, user_id, household_role)
  VALUES (v_household_id, v_user_id, 'primary_owner')
  ON CONFLICT (household_id, user_id) DO NOTHING;

  -- Record audit log entry
  INSERT INTO public.admin_audit_logs (
    actor_user_id,
    target_user_id,
    action,
    outcome,
    reason_code,
    safe_metadata
  ) VALUES (
    v_user_id,
    v_user_id,
    'BOOTSTRAP_ADMIN_GRANTED',
    'success',
    'CLI_BOOTSTRAP',
    jsonb_build_object(
      'email', '${ADMIN_EMAIL}',
      'role', 'super_admin',
      'timestamp', now()
    )
  );

  RAISE NOTICE 'Successfully granted super_admin role to % (User ID: %)', '${ADMIN_EMAIL}', v_user_id;
END;
\$\$;
EOF
)

echo "$SQL_PAYLOAD" | $EXEC_CMD

echo "Bootstrap completed successfully."
