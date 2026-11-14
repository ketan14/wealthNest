// ============================================================================
// Edge Function: admin-create-user
// Resolves KEY-03 / BE-02: Provisions new platform users server-side using the
// Supabase Service Role key inside a trusted Deno runtime, enforcing caller
// JWT validation, active platform admin RBAC, password complexity, and audit logs.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

type PlatformRole = 'super_admin' | 'support_admin' | 'auditor';

const ALLOWED_ROLES: ReadonlySet<PlatformRole> = new Set([
  'super_admin',
  'support_admin',
  'auditor',
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_MAX_CREATES_PER_MIN = 10;
const DEFAULT_MAX_CREATES_PER_15M = 30;

function resolveRateLimit(envName: string, fallback: number, maxCap: number): number {
  const raw = Number(Deno.env.get(envName) ?? '');
  if (!Number.isFinite(raw) || raw < 1) {
    return fallback;
  }
  return Math.min(Math.floor(raw), maxCap);
}

const ALLOWED_CORS_HEADERS =
  'authorization, x-client-info, apikey, content-type, x-retry-count, x-region';

function buildCorsHeaders(req: Request): { headers: Record<string, string>; originAllowed: boolean } {
  const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const reqOrigin = req.headers.get('Origin') ?? '';
  const hasAllowlist = configuredOrigins.length > 0;
  const matched = Boolean(reqOrigin && configuredOrigins.includes(reqOrigin));

  return {
    originAllowed: !hasAllowlist || !reqOrigin || matched,
    headers: {
      'Access-Control-Allow-Origin': hasAllowlist
        ? matched
          ? reqOrigin
          : configuredOrigins[0]
        : '*',
      'Access-Control-Allow-Headers': ALLOWED_CORS_HEADERS,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    },
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function validatePasswordComplexity(password: string): string | null {
  if (typeof password !== 'string' || password.length < 12) {
    return 'Password must be at least 12 characters long';
  }
  if (password.length > 128) {
    return 'Password exceeds maximum allowed length';
  }
  if (
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return 'Password must include uppercase, lowercase, numeric, and special characters';
  }
  return null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const { headers: corsHeaders, originAllowed } = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!originAllowed) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('admin-create-user missing server configuration');
    return jsonResponse({ error: 'Server configuration error' }, 500, corsHeaders);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing bearer authorization token' }, 401, corsHeaders);
  }
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) {
    return jsonResponse({ error: 'Invalid authorization header' }, 401, corsHeaders);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // 1. Cryptographically verify caller session via Supabase Auth API
  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  const caller = userData?.user;
  if (authError || !caller) {
    return jsonResponse({ error: 'Unauthorized: Invalid or expired session' }, 401, corsHeaders);
  }

  // 2. Verify caller account is not suspended or deactivated
  const { data: callerAccessStatus } = await supabaseAdmin
    .from('user_access_status')
    .select('status')
    .eq('user_id', caller.id)
    .maybeSingle();

  if (
    callerAccessStatus?.status === 'suspended' ||
    callerAccessStatus?.status === 'deactivated'
  ) {
    return jsonResponse({ error: 'Forbidden: Account is suspended or deactivated' }, 403, corsHeaders);
  }

  // 3. Verify active platform admin role in public.platform_admin_roles
  const { data: adminRoleRow, error: roleLookupError } = await supabaseAdmin
    .from('platform_admin_roles')
    .select('role')
    .eq('user_id', caller.id)
    .eq('is_active', true)
    .maybeSingle();

  if (roleLookupError) {
    console.error('admin-create-user role lookup failed:', roleLookupError.message);
    return jsonResponse({ error: 'Authorization lookup failed' }, 500, corsHeaders);
  }

  const callerRole = adminRoleRow?.role as PlatformRole | undefined;
  if (callerRole !== 'super_admin' && callerRole !== 'support_admin') {
    await supabaseAdmin.from('admin_audit_logs').insert({
      actor_user_id: caller.id,
      action: 'ADMIN_USER_CREATED',
      outcome: 'denied',
      reason_code: 'INSUFFICIENT_PRIVILEGES',
      safe_metadata: { caller_role: callerRole ?? 'none' },
    });
    return jsonResponse(
      { error: 'Forbidden: Only super_admin or support_admin can provision users' },
      403,
      corsHeaders
    );
  }

  // 3b. Enforce persistent Postgres-backed sliding-window rate limits per admin caller (AUTH-08)
  const nowMs = Date.now();
  const oneMinAgoMs = nowMs - 60 * 1000;
  const fifteenMinAgoIso = new Date(nowMs - 15 * 60 * 1000).toISOString();
  const maxPerMin = resolveRateLimit('ADMIN_CREATE_RATE_LIMIT_PER_MIN', DEFAULT_MAX_CREATES_PER_MIN, 100);
  const maxPer15m = resolveRateLimit('ADMIN_CREATE_RATE_LIMIT_PER_15M', DEFAULT_MAX_CREATES_PER_15M, 500);

  const { data: recentEvents, error: rateLookupError } = await supabaseAdmin
    .from('admin_audit_logs')
    .select('created_at, reason_code')
    .eq('actor_user_id', caller.id)
    .eq('action', 'ADMIN_USER_CREATED')
    .gte('created_at', fifteenMinAgoIso)
    .limit(500);

  if (rateLookupError) {
    console.error('admin-create-user rate limit lookup failed:', rateLookupError.message);
    return jsonResponse({ error: 'Rate limit verification unavailable' }, 500, corsHeaders);
  }

  const countedEvents = (recentEvents ?? []).filter(
    (entry: { created_at: string; reason_code: string | null }) =>
      entry.reason_code !== 'RATE_LIMIT_EXCEEDED'
  );
  const countInLast15m = countedEvents.length;
  const countInLastMin = countedEvents.filter(
    (entry: { created_at: string }) => Date.parse(entry.created_at) >= oneMinAgoMs
  ).length;

  if (countInLastMin >= maxPerMin || countInLast15m >= maxPer15m) {
    const retryAfterSec = countInLastMin >= maxPerMin ? '60' : '900';
    await supabaseAdmin.from('admin_audit_logs').insert({
      actor_user_id: caller.id,
      action: 'ADMIN_USER_CREATED',
      outcome: 'denied',
      reason_code: 'RATE_LIMIT_EXCEEDED',
      safe_metadata: {
        count_1m: countInLastMin,
        count_15m: countInLast15m,
      },
    });
    return jsonResponse(
      { error: 'Too many user provisioning requests. Please wait before retrying.' },
      429,
      corsHeaders,
      { 'Retry-After': retryAfterSec }
    );
  }

  // 4. Parse and strictly validate payload (reject mass assignment / unsafe values)
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body' }, 400, corsHeaders);
  }

  const rawEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const rawPassword = typeof payload.password === 'string' ? payload.password : '';
  const rawDisplayName =
    typeof payload.displayName === 'string' ? payload.displayName.trim() : '';
  const rawInitialRole =
    typeof payload.initialRole === 'string' && payload.initialRole.trim() !== ''
      ? payload.initialRole.trim()
      : undefined;

  if (!rawEmail || rawEmail.length > 254 || !EMAIL_PATTERN.test(rawEmail)) {
    return jsonResponse({ error: 'A valid email address is required' }, 400, corsHeaders);
  }

  const passwordError = validatePasswordComplexity(rawPassword);
  if (passwordError) {
    return jsonResponse({ error: passwordError }, 400, corsHeaders);
  }

  if (rawDisplayName.length > 120) {
    return jsonResponse({ error: 'Display name must not exceed 120 characters' }, 400, corsHeaders);
  }

  if (rawInitialRole !== undefined) {
    if (!ALLOWED_ROLES.has(rawInitialRole as PlatformRole)) {
      return jsonResponse({ error: 'Invalid initial platform role requested' }, 400, corsHeaders);
    }
    if (callerRole !== 'super_admin') {
      await supabaseAdmin.from('admin_audit_logs').insert({
        actor_user_id: caller.id,
        action: 'ADMIN_USER_CREATED',
        outcome: 'denied',
        reason_code: 'ROLE_GRANT_REQUIRES_SUPER_ADMIN',
        safe_metadata: { requested_role: rawInitialRole },
      });
      return jsonResponse(
        { error: 'Forbidden: Only super_admin can assign a platform role on creation' },
        403,
        corsHeaders
      );
    }
  }

  const safeDisplayName = rawDisplayName || rawEmail.split('@')[0] || 'Investor';

  // 5. Create Auth user via Admin API (never overwrites caller session)
  const { data: createdData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: rawEmail,
    password: rawPassword,
    email_confirm: true,
    user_metadata: {
      full_name: safeDisplayName,
      display_name: safeDisplayName,
    },
  });

  if (createError || !createdData?.user) {
    const statusCode =
      createError?.message?.toLowerCase().includes('already') ||
      createError?.status === 422
        ? 409
        : 400;
    return jsonResponse(
      { error: createError?.message ?? 'Failed to provision user account' },
      statusCode,
      corsHeaders
    );
  }

  const createdUser = createdData.user;

  // 6. Optionally assign platform role (super_admin verified above)
  if (rawInitialRole) {
    const { error: insertRoleError } = await supabaseAdmin
      .from('platform_admin_roles')
      .insert({
        user_id: createdUser.id,
        role: rawInitialRole,
        is_active: true,
        granted_by: caller.id,
      });

    if (insertRoleError) {
      console.error('admin-create-user role insert failed:', insertRoleError.message);
      await supabaseAdmin.from('admin_audit_logs').insert({
        actor_user_id: caller.id,
        target_user_id: createdUser.id,
        action: 'ADMIN_USER_CREATED',
        outcome: 'failure',
        reason_code: 'ROLE_ASSIGNMENT_FAILED',
        safe_metadata: { target_email: rawEmail, requested_role: rawInitialRole },
      });
      return jsonResponse(
        { error: 'User account created, but initial role assignment failed' },
        500,
        corsHeaders
      );
    }
  }

  // 7. Record immutable audit log entry
  await supabaseAdmin.from('admin_audit_logs').insert({
    actor_user_id: caller.id,
    target_user_id: createdUser.id,
    action: 'ADMIN_USER_CREATED',
    outcome: 'success',
    safe_metadata: {
      target_email: rawEmail,
      assigned_role: rawInitialRole ?? null,
    },
  });

  return jsonResponse(
    {
      userId: createdUser.id,
      email: createdUser.email ?? rawEmail,
    },
    201,
    corsHeaders
  );
});

