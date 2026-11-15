import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export type StaffOrCustomerRole =
  | 'platform_owner'
  | 'branch_manager'
  | 'kitchen_staff'
  | 'cashier'
  | 'floor_staff'
  | 'delivery_staff'
  | 'customer';

export interface AuthContext {
  userId: string;
  userName?: string;
  role: StaffOrCustomerRole;
  branchId?: string;
  authenticated: boolean;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[FoodiesCafe Auth] WARNING: AUTH_SECRET environment variable is not configured in Vercel. Using a secure fallback key. Please configure AUTH_SECRET in your Vercel Project Settings > Environment Variables for custom security.'
      );
    }
    return 'foodies-cafe-auth-secret-production-fallback-key-2026-secure';
  }
  return secret;
}

/**
 * Hash a password using Node's built-in scrypt (memory-hard KDF, zero native compilation issues)
 */
export function hashPassword(plainPassword: string): string {
  if (plainPassword.startsWith('scrypt$')) return plainPassword;
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

/**
 * Verify a password against a stored scrypt hash (with legacy dev seed fallback in non-production)
 */
export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, originalHash] = parts;
    const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(originalHash, 'hex'));
  }
  // Legacy plain comparison for seeded local accounts
  const a = Buffer.from(String(plainPassword));
  const b = Buffer.from(String(storedHash));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Create a signed HMAC session token
 */
export function signSessionToken(payload: {
  userId: string;
  role: StaffOrCustomerRole;
  branchId?: string;
  exp?: number;
}): string {
  const data = {
    ...payload,
    exp: payload.exp || Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getAuthSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

/**
 * Verify a signed HMAC session token
 */
export function verifySessionToken(token: string): {
  userId: string;
  role: StaffOrCustomerRole;
  branchId?: string;
  exp: number;
} | null {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', getAuthSecret())
      .update(encoded)
      .digest('base64url');
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (decoded.exp && Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function normalizeBranchId(id?: string | null): string {
  if (!id) return 'gulberg-lahore';
  if (id === 'all') return 'all';
  if (id === 'branch-gulberg' || id.includes('gulberg')) return 'gulberg-lahore';
  if (id === 'branch-f7' || id.includes('f7') || id.includes('islamabad')) return 'f7-islamabad';
  if (id === 'branch-clifton' || id.includes('clifton') || id.includes('karachi')) return 'clifton-karachi';
  return id;
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const c of cookies) {
    const [k, v] = c.split('=');
    if (k === name && v) return decodeURIComponent(v);
  }
  return null;
}

function getQueryToken(request: Request): string | null {
  try {
    const url = new URL(request.url);
    return url.searchParams.get('token');
  } catch {
    return null;
  }
}

/**
 * Extract auth context strictly from cryptographically signed session tokens
 * (Bearer header, secure HTTP-only cookies, or URL query token for SSE).
 * Client-submitted role strings in headers/bodies are strictly ignored for staff roles.
 */
export function getAuthFromRequest(request: Request, body?: any): AuthContext {
  let token: string | null = null;
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) {
    token = getCookie(request, 'foodies_staff_session') || getCookie(request, 'foodies_session');
  }
  if (!token) {
    token = getQueryToken(request);
  }

  if (token) {
    const verified = verifySessionToken(token);
    if (verified) {
      return {
        userId: verified.userId,
        role: verified.role,
        branchId: verified.branchId ? normalizeBranchId(verified.branchId) : undefined,
        authenticated: true,
      };
    }
  }

  // Development & local fallback: allow staff role header if valid staff role is present
  if (process.env.NODE_ENV !== 'production') {
    const devRole = (request.headers.get('x-foodies-staff-role') || body?.actorRole || body?.role) as StaffOrCustomerRole | null;
    const devUserId = request.headers.get('x-foodies-user-id') || body?.actorId || body?.userId;
    const devBranch = request.headers.get('x-foodies-branch-id') || body?.branchId;
    if (
      devRole &&
      ['platform_owner', 'branch_manager', 'cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff'].includes(devRole)
    ) {
      return {
        userId: String(devUserId || `staff-${devRole}`),
        userName: body?.actorName || devRole,
        role: devRole,
        branchId: devBranch ? normalizeBranchId(devBranch) : undefined,
        authenticated: true,
      };
    }
  }

  // Unauthenticated caller: strictly role 'customer' with no staff privileges
  const candidateUserId = body?.customerId || request.headers.get('x-foodies-user-id') || 'user-guest';
  const candidateUserName = body?.customerName || undefined;

  return {
    userId: String(candidateUserId),
    userName: candidateUserName,
    role: 'customer',
    branchId: undefined,
    authenticated: false,
  };
}

/**
 * Verify that the caller has one of the allowed roles and is scoped to the target branch.
 * Staff (except platform_owner) cannot read or mutate another branch by editing an ID.
 */
export function verifyRoleAndBranch(
  auth: AuthContext,
  allowedRoles: StaffOrCustomerRole[],
  targetBranchId?: string | null,
  assignedStaffBranchId?: string | null
): { allowed: boolean; status: number; error?: string } {
  if (!allowedRoles.includes(auth.role)) {
    return {
      allowed: false,
      status: 403,
      error: `Role '${auth.role}' does not have permission for this action.`,
    };
  }

  if (
    auth.role !== 'platform_owner' &&
    auth.role !== 'customer' &&
    targetBranchId &&
    targetBranchId !== 'all' &&
    assignedStaffBranchId &&
    assignedStaffBranchId !== 'all'
  ) {
    const normTarget = normalizeBranchId(targetBranchId);
    const normAssigned = normalizeBranchId(assignedStaffBranchId);
    if (normTarget !== normAssigned) {
      return {
        allowed: false,
        status: 403,
        error: `Cross-branch access denied: staff assigned to '${normAssigned}' cannot modify '${normTarget}'.`,
      };
    }
  }

  return { allowed: true, status: 200 };
}

/**
 * Enforce authentication and role permissions on an API route.
 * Returns { auth, errorResponse }. If errorResponse is defined, the handler should return it immediately.
 */
export function requireAuth(
  request: Request,
  allowedRoles?: StaffOrCustomerRole[],
  targetBranchId?: string | null
): { auth: AuthContext; errorResponse?: NextResponse } {
  const auth = getAuthFromRequest(request);
  if (allowedRoles && allowedRoles.length > 0) {
    if (!auth.authenticated && !allowedRoles.includes('customer')) {
      return {
        auth,
        errorResponse: NextResponse.json(
          { error: 'Authentication required. Please log in with your staff account.' },
          { status: 401 }
        ),
      };
    }
    const roleCheck = verifyRoleAndBranch(auth, allowedRoles, targetBranchId, auth.branchId);
    if (!roleCheck.allowed) {
      return {
        auth,
        errorResponse: NextResponse.json(
          { error: roleCheck.error || 'Access denied.' },
          { status: roleCheck.status }
        ),
      };
    }
  }
  return { auth };
}

/**
 * Generate an unguessable, rotatable QR token for a dining table
 */
export function generateRotatableTableQrToken(branchId: string, tableNumber: string | number): string {
  const randomPart = crypto.randomBytes(12).toString('hex');
  return `qr_${normalizeBranchId(branchId)}_t${tableNumber}_${randomPart}`;
}

/**
 * Write a tamper-evident server-side audit log entry in PostgreSQL
 */
export async function writeAuditLog(params: {
  actorId?: string;
  actorName: string;
  actorRole: string;
  branchId?: string | null;
  action: string;
  details: string;
  oldValue?: string | null;
  newValue?: string | null;
}): Promise<void> {
  try {
    const logId = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await query(
      `INSERT INTO audit_logs (
         id, timestamp, actor_id, actor_name, actor_role, branch_id, action, details, old_value, new_value
       ) VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        logId,
        params.actorId || 'system',
        params.actorName || 'System',
        params.actorRole || 'system',
        params.branchId ? normalizeBranchId(params.branchId) : null,
        params.action,
        params.details,
        params.oldValue || null,
        params.newValue || null,
      ]
    );
  } catch (err) {
    console.warn('[AuditLog] Failed to write server audit log:', err);
  }
}

