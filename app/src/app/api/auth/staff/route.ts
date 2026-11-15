import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  verifyPassword,
  signSessionToken,
  getAuthFromRequest,
  writeAuditLog,
  normalizeBranchId,
} from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Rate limit: 10 attempts per minute per IP
    const rl = await checkRateLimit({
      scope: 'login',
      identifier: clientIp,
      maxRequests: 10,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Too many login attempts. Please try again in ${rl.resetInSeconds} seconds.` },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { identifier, password } = body;

    if (!identifier || typeof identifier !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Staff identifier and password are required.' },
        { status: 400 }
      );
    }

    const idClean = identifier.trim();
    const idLower = idClean.toLowerCase();

    // Query user in database
    const res = await query(
      `SELECT id, name, phone, email, role, branch_id, status, password_hash
       FROM users
       WHERE LOWER(email) = $1 OR id = $2 OR phone = $2
       LIMIT 1`,
      [idLower, idClean]
    );

    const user = res.rows[0];
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid staff credentials.' },
        { status: 401 }
      );
    }

    if (user.status !== 'active') {
      const statusWord = user.status === 'suspended' ? 'suspended' : user.status === 'blocked' ? 'blocked' : 'deactivated';
      return NextResponse.json(
        { error: `This staff account has been ${statusWord}. Login access is revoked. Please contact platform management.` },
        { status: 403 }
      );
    }

    const isMatch = verifyPassword(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid staff credentials.' },
        { status: 401 }
      );
    }

    // Ensure staff has a valid role
    if (user.role === 'customer') {
      return NextResponse.json(
        { error: 'This account does not have staff permissions.' },
        { status: 403 }
      );
    }

    const normBranch = user.branch_id ? normalizeBranchId(user.branch_id) : undefined;
    const sessionToken = signSessionToken({
      userId: user.id,
      role: user.role,
      branchId: normBranch,
    });

    // Fire-and-forget: don't make the user wait on the audit write.
    void writeAuditLog({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      branchId: normBranch || null,
      action: 'staff_login',
      details: `Staff ${user.name} (${user.role}) logged in successfully.`,
    }).catch(() => {});

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        branchId: normBranch,
        status: user.status,
      },
      sessionToken,
    });

    // Set secure HTTP-only cookie for web browsers (8-hour shift max)
    response.cookies.set('foodies_staff_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('[StaffAuth] Login error:', error);
    return NextResponse.json(
      { error: 'Internal authentication error. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const auth = getAuthFromRequest(request);
  if (!auth.authenticated || auth.role === 'customer') {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const res = await query(
    `SELECT id, name, phone, email, role, branch_id, status FROM users WHERE id = $1 LIMIT 1`,
    [auth.userId]
  );
  const user = res.rows[0];
  if (!user || user.status !== 'active') {
    return NextResponse.json({ authenticated: false, error: 'User inactive' }, { status: 403 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      branchId: user.branch_id,
      status: user.status,
    },
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.set('foodies_staff_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
