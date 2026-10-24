#!/usr/bin/env bash
# ==============================================================================
# WealthNest Platform Administration Bootstrap & Credential Generator Script
# Safely creates or updates administrator accounts with chosen credentials,
# grants platform roles (super_admin, support_admin, auditor), and creates audit log.
# ==============================================================================

set -euo pipefail

ADMIN_EMAIL="${1:-investor@wealthnest.local}"
ADMIN_PASSWORD="${2:-WealthNest@2026}"
ADMIN_ROLE="${3:-super_admin}"
ADMIN_NAME="${4:-Ketan Vaghela}"
CONTAINER_NAME="supabase_db_wealthnest"

echo "=================================================="
echo " WealthNest Platform Administrator Generator"
echo "=================================================="
echo "Target Administrator : ${ADMIN_EMAIL}"
echo "Assigned Role        : ${ADMIN_ROLE}"
echo "Full Name            : ${ADMIN_NAME}"
echo "Password Configured  : [HIDDEN]"
echo "=================================================="

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
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO \$\$
DECLARE
  v_user_id uuid;
  v_household_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_hashed_pw text := crypt('${ADMIN_PASSWORD}', gen_salt('bf', 10));
BEGIN
  -- 1. Lookup target user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = '${ADMIN_EMAIL}'
  LIMIT 1;

  -- 2. Create user in auth.users if not already present
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      phone_change,
      phone_change_token,
      email_change_token_current,
      reauthentication_token,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      '${ADMIN_EMAIL}',
      v_hashed_pw,
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('sub', v_user_id, 'email', '${ADMIN_EMAIL}', 'full_name', '${ADMIN_NAME}'),
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      now(),
      now()
    );

    -- Also insert corresponding auth identity for password authentication
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id, 'email', '${ADMIN_EMAIL}'),
      'email',
      now(),
      now()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;

    RAISE NOTICE 'Created new auth user for % (User ID: %)', '${ADMIN_EMAIL}', v_user_id;
  ELSE
    -- User already exists: update password to configured value
    UPDATE auth.users
    SET encrypted_password = v_hashed_pw,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_user_id;

    RAISE NOTICE 'Updated password for existing user % (User ID: %)', '${ADMIN_EMAIL}', v_user_id;
  END IF;

  -- 3. Ensure profile exists and has display_name
  INSERT INTO public.profiles (id, display_name, default_currency, created_at, updated_at)
  VALUES (v_user_id, '${ADMIN_NAME}', 'INR', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    updated_at = now();

  -- 4. Ensure user_access_status is active
  INSERT INTO public.user_access_status (user_id, status, reason_code, reason_details)
  VALUES (v_user_id, 'active', 'MANUAL_BOOTSTRAP', 'Initial system administrator promotion')
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    updated_at = now();

  -- 5. Grant or update platform admin role
  INSERT INTO public.platform_admin_roles (user_id, role, is_active, granted_at)
  VALUES (v_user_id, '${ADMIN_ROLE}', true, now());

  UPDATE public.platform_admin_roles
  SET is_active = true,
      revoked_at = NULL,
      revoked_by = NULL,
      updated_at = now()
  WHERE user_id = v_user_id AND role = '${ADMIN_ROLE}';

  -- 6. Ensure default household exists
  INSERT INTO public.households (id, name, created_by)
  VALUES (v_household_id, 'Vaghela Household', v_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- 7. Ensure primary_owner membership
  INSERT INTO public.household_members (household_id, user_id, household_role)
  VALUES (v_household_id, v_user_id, 'primary_owner')
  ON CONFLICT (household_id, user_id) DO NOTHING;

  -- 8. Record audit log entry
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
      'role', '${ADMIN_ROLE}',
      'timestamp', now()
    )
  );

  RAISE NOTICE 'Successfully granted % role to % (User ID: %)', '${ADMIN_ROLE}', '${ADMIN_EMAIL}', v_user_id;
END;
\$\$;
EOF
)

echo "$SQL_PAYLOAD" | $EXEC_CMD

echo "=================================================="
echo " Admin credential configured successfully!"
echo " Email    : ${ADMIN_EMAIL}"
echo " Password : ${ADMIN_PASSWORD}"
echo " Role     : ${ADMIN_ROLE}"
echo " URL      : http://localhost:5174/settings"
echo " Admin UI : http://localhost:5174/admin"
echo "=================================================="
