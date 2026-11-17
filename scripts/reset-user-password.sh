#!/usr/bin/env bash
# ==============================================================================
# WealthNest — CLI Password Reset Utility (Local or Linked Supabase Cloud)
#
# Usage:
#   ./scripts/reset-user-password.sh
#   ./scripts/reset-user-password.sh <email>
#   ./scripts/reset-user-password.sh <email> <new_password>
#   TARGET=local ./scripts/reset-user-password.sh <email> <new_password>
# ==============================================================================
set -euo pipefail

TARGET="${TARGET:-linked}" # 'linked' for Cloud QA/Prod, 'local' for local dev
EMAIL="${1:-}"
PASSWORD="${2:-}"

echo "=================================================="
echo " WealthNest — User Password Reset Utility"
echo "=================================================="
echo "Target Database: $TARGET"

# 1. Prompt for Email if not provided as argument
if [ -z "$EMAIL" ]; then
  read -r -p "Enter user email: " EMAIL
fi

EMAIL="$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | xargs)"

if [ -z "$EMAIL" ]; then
  echo "❌ Error: Email cannot be empty."
  exit 1
fi

# 2. Prompt for Password securely (silent input) if not provided as argument
if [ -z "$PASSWORD" ]; then
  read -r -s -p "Enter new password (min 12 characters): " PASSWORD
  echo ""
  read -r -s -p "Confirm new password: " PASSWORD_CONFIRM
  echo ""

  if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
    echo "❌ Error: Passwords do not match."
    exit 1
  fi
fi

# 3. Validate password length
if [ ${#PASSWORD} -lt 12 ]; then
  echo "❌ Error: Password must be at least 12 characters long to comply with WealthNest security policy."
  exit 1
fi

echo "🔄 Updating password for '$EMAIL' on $TARGET database..."

# 4. Construct SQL statement safely with SQL escaping
# Escape single quotes in password and email for SQL injection safety
ESCAPED_EMAIL="${EMAIL//\'/\'\'}"
ESCAPED_PASSWORD="${PASSWORD//\'/\'\'}"

SQL_COMMAND="
DO \$\$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower('$ESCAPED_EMAIL');
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % does not exist', '$ESCAPED_EMAIL';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt('$ESCAPED_PASSWORD', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = v_user_id;

  RAISE NOTICE 'Password successfully updated for user % (ID: %)', '$ESCAPED_EMAIL', v_user_id;
END \$\$;
"

# 5. Execute via Supabase CLI
if [ "$TARGET" = "linked" ]; then
  npx supabase db query --linked "$SQL_COMMAND"
else
  npx supabase db query --local "$SQL_COMMAND"
fi

echo "=================================================="
echo "✅ Password reset successfully completed!"
echo "User: $EMAIL"
echo "=================================================="
