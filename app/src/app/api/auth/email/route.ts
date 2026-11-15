import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import db from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { signSessionToken } from '@/lib/auth';

// Temporary in-memory OTP store with 5-minute expiry (fallback for local dev)
// Key: normalized email, Value: { code: string; expiresAt: number }
const otpStore = new Map<string, { code: string; expiresAt: number }>();

const OTP_SECRET = process.env.AUTH_SECRET || process.env.MAIL_ACCOUNT_KEY || 'foodies-cafe-otp-secret-key-2026';

function generateSignedToken(email: string, code: string, expiresAt: number): string {
  const payload = `${email.toLowerCase().trim()}:${code.trim()}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', OTP_SECRET).update(payload).digest('hex');
  return `${expiresAt}.${hmac}`;
}

function verifySignedToken(email: string, code: string, token?: string): boolean {
  if (!token || !token.includes('.')) return false;
  const [expiresAtStr, hmac] = token.split('.');
  const expiresAt = Number(expiresAtStr);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const payload = `${email.toLowerCase().trim()}:${code.trim()}:${expiresAt}`;
  const expectedHmac = crypto.createHmac('sha256', OTP_SECRET).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'));
  } catch (e) {
    return false;
  }
}

interface SmtpConfig {
  user: string;
  pass: string;
  host: string;
  port: number;
  from: string;
  provider: 'gmail' | 'custom_smtp' | 'none';
}

function getDynamicMailConfig(clientOverrides?: {
  accountEmail?: string;
  accountApiKey?: string;
  smtpHost?: string;
  smtpPort?: string | number;
}): SmtpConfig {
  // 1. Optional test overrides (non-production only)
  if (
    process.env.NODE_ENV !== 'production' &&
    clientOverrides?.accountEmail &&
    clientOverrides?.accountApiKey
  ) {
    const user = clientOverrides.accountEmail.trim();
    const pass = clientOverrides.accountApiKey.trim().replace(/\s+/g, '');
    const isGmail = user.toLowerCase().endsWith('@gmail.com') || user.toLowerCase().endsWith('@googlemail.com');
    const host = clientOverrides.smtpHost?.trim() || 'smtp.gmail.com';
    const port = Number(clientOverrides.smtpPort) || 465;

    return {
      user,
      pass,
      host,
      port,
      from: `"FoodiesCafe" <${user}>`,
      provider: isGmail ? 'gmail' : 'custom_smtp',
    };
  }

  // 2. Read exclusively from environment variables (no hardcoded disk paths)
  const user = (process.env.MAIL_ACCOUNT_USER || process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = (process.env.MAIL_ACCOUNT_KEY || process.env.SMTP_PASS || process.env.EMAIL_PASS || '')
    .trim()
    .replace(/\s+/g, '');
  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT) || 465;
  const from = (process.env.EMAIL_FROM || '').trim();

  if (!user || !pass) {
    return {
      user: '',
      pass: '',
      host: 'smtp.gmail.com',
      port: 465,
      from: '',
      provider: 'none',
    };
  }

  const isGmail = user.toLowerCase().endsWith('@gmail.com') || user.toLowerCase().endsWith('@googlemail.com');
  const finalHost = host || 'smtp.gmail.com';
  const finalFrom = from || `"FoodiesCafe" <${user}>`;

  return {
    user,
    pass,
    host: finalHost,
    port,
    from: finalFrom,
    provider: isGmail ? 'gmail' : 'custom_smtp',
  };
}

export async function GET() {
  const config = getDynamicMailConfig();
  const isConfigured = !!(config.user && config.pass);

  return NextResponse.json({
    status: 'ok',
    isConfigured,
    provider: config.provider,
    accountEmail: config.user || null,
    accountPreview: config.user ? `${config.user.slice(0, 3)}***@${config.user.split('@')[1] || ''}` : null,
    smtpHost: config.host,
    guide: {
      title: 'Automated Email Sending from Your Account (Sends to Everyone)',
      steps: [
        '1. Use any Gmail, Google Workspace, Outlook, or SMTP email account.',
        '2. For Gmail: Go to https://myaccount.google.com/apppasswords',
        '3. Create an App Password named "FoodiesCafe" (generates a 16-letter API key).',
        '4. Add to .env: MAIL_ACCOUNT_USER=youraccount@gmail.com and MAIL_ACCOUNT_KEY=your-16-letter-key',
        '5. Or paste it directly in the in-app [🔑 Mail Account Setup] modal to test and send instantly!',
      ],
      advantages: 'Sends automated emails to ANY customer with ZERO domain restrictions, 100% free!',
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, code, emailToken, clientMailConfig } = body;

    // ========================================================
    // ACTION: SAVE SERVER CONFIG (Disabled disk writing; env only)
    // ========================================================
    if (action === 'save_server_config') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Writing SMTP secrets to disk from the browser is disabled for security. Configure MAIL_ACCOUNT_USER and MAIL_ACCOUNT_KEY via environment variables.',
        },
        { status: 403 }
      );
    }

    // ========================================================
    // ACTION: TEST MAIL ACCOUNT / SENDER
    // ========================================================
    if (action === 'test_account') {
      const config = getDynamicMailConfig(clientMailConfig);
      if (!config.user || !config.pass) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing account email or API key / App Password. Please provide both your email address and 16-character App Password.',
          },
          { status: 400 }
        );
      }

      const targetEmail = (email && typeof email === 'string' && email.trim()) || config.user;

      try {
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.port === 465,
          auth: {
            user: config.user,
            pass: config.pass,
          },
          tls: {
            rejectUnauthorized: false,
          },
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 10000,
        });

        // Verify transporter credentials
        await transporter.verify();

        // Send a live test email
        await transporter.sendMail({
          from: config.from,
          to: targetEmail,
          subject: '☕ FoodiesCafe — Automated Mail System Connected!',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; background: #FFF5F2; border: 1px solid #E5E7EB; border-radius: 12px; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #8B2500; margin: 0 0 10px;">☕ FoodiesCafe Automated Email System</h2>
              <p style="color: #374151; font-size: 14px; line-height: 1.6;">
                Success! Your mail account <strong>${config.user}</strong> is connected and can now send automated verification codes to <strong>anyone and everyone</strong>.
              </p>
              <div style="background: #FFFFFF; border-left: 4px solid #8B2500; padding: 12px; margin: 16px 0; font-size: 13px; color: #4B5563;">
                ✓ Sender Account: <strong>${config.user}</strong><br/>
                ✓ SMTP Host: <strong>${config.host}</strong><br/>
                ✓ Recipient Test: <strong>${targetEmail}</strong>
              </div>
              <p style="font-size: 12px; color: #9CA3AF; margin: 0;">FoodiesCafe Multi-Branch Restaurant System</p>
            </div>
          `,
        });

        return NextResponse.json({
          success: true,
          message: `Test email successfully sent from ${config.user} to ${targetEmail}!`,
          sender: config.user,
        });
      } catch (err: any) {
        console.error('[FoodiesCafe Mail Auth] SMTP Error during test:', err);
        let friendlyMsg = err.message || 'SMTP Authentication failed.';
        if (err.code === 'EAUTH' || friendlyMsg.includes('BadCredentials') || friendlyMsg.includes('Invalid login')) {
          friendlyMsg =
            'Google / SMTP Authentication Failed: Please make sure you are using a 16-letter Google "App Password" (from https://myaccount.google.com/apppasswords), NOT your normal Google password!';
        }

        return NextResponse.json(
          {
            success: false,
            error: friendlyMsg,
            originalError: err.message,
          },
          { status: 400 }
        );
      }
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'A valid customer email address is required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const clientIp = getClientIp(req);

    // ========================================================
    // ACTION: VERIFY CODE
    // ========================================================
    if (action === 'verify') {
      const rlVerify = await checkRateLimit({
        scope: 'otp_verify',
        identifier: `${normalizedEmail}:${clientIp}`,
        maxRequests: 8,
        windowSeconds: 600,
      });
      if (!rlVerify.allowed) {
        return NextResponse.json(
          { error: `Too many verification attempts. Please wait ${rlVerify.resetInSeconds}s.` },
          { status: 429 }
        );
      }

      if (!code || typeof code !== 'string') {
        return NextResponse.json(
          { error: 'Please provide the 4-digit verification code.' },
          { status: 400 }
        );
      }

      const inputCode = code.trim();
      let isValid = false;

      // 1. Master code bypass for local dev / testing ONLY (strictly disabled in production)
      if (process.env.NODE_ENV !== 'production' && (inputCode === '1234' || inputCode === '5829')) {
        isValid = true;
      }

      // 2. Stateless HMAC signed token validation (100% resilient across serverless lambdas)
      if (!isValid && emailToken && typeof emailToken === 'string') {
        if (verifySignedToken(normalizedEmail, inputCode, emailToken)) {
          isValid = true;
        }
      }

      // 3. PostgreSQL database OTP lookup
      if (!isValid) {
        try {
          const dbRes = await db.query(
            'SELECT code, expires_at FROM email_otps WHERE email = $1',
            [normalizedEmail]
          );
          if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
            const row = dbRes.rows[0];
            const exp = Number(row.expires_at);
            if (row.code === inputCode && Date.now() <= exp) {
              isValid = true;
              // Clean up used OTP
              await db.query('DELETE FROM email_otps WHERE email = $1', [normalizedEmail]);
            }
          }
        } catch (dbErr) {
          // DB query failed or table not initialized yet, fall through
        }
      }

      // 4. In-memory fallback
      if (!isValid) {
        const stored = otpStore.get(normalizedEmail);
        if (stored && stored.code === inputCode && Date.now() <= stored.expiresAt) {
          isValid = true;
          otpStore.delete(normalizedEmail);
        }
      }

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid verification code. Please check your email and try again.' },
          { status: 400 }
        );
      }

      // Cleanup in-memory if present
      otpStore.delete(normalizedEmail);

      const isMobileApp = body?.platform === 'app' || body?.platform === 'mobile';
      const tokenDurationMs = isMobileApp
        ? 30 * 24 * 60 * 60 * 1000 // 30 days for mobile app
        : 24 * 60 * 60 * 1000;      // 24 hours for web

      const sessionToken = signSessionToken({
        userId: `cust-${normalizedEmail}`,
        role: 'customer',
        exp: Date.now() + tokenDurationMs,
      });

      const response = NextResponse.json({
        success: true,
        message: 'Email successfully verified!',
        email: normalizedEmail,
        sessionToken,
        expiresInMs: tokenDurationMs,
      });

      const maxAgeSeconds = Math.floor(tokenDurationMs / 1000);
      response.cookies.set('foodies_customer_session', sessionToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: maxAgeSeconds,
      });

      return response;
    }

    // ========================================================
    // ACTION: SEND VERIFICATION CODE
    // ========================================================
    if (action === 'send') {
      const rlSend = await checkRateLimit({
        scope: 'otp_send',
        identifier: `${normalizedEmail}:${clientIp}`,
        maxRequests: 5,
        windowSeconds: 600,
      });
      if (!rlSend.allowed) {
        return NextResponse.json(
          { error: `Too many OTP requests. Please try again in ${rlSend.resetInSeconds}s.` },
          { status: 429 }
        );
      }

      // Generate secure 4-digit OTP code
      const generatedCode = String(Math.floor(1000 + Math.random() * 9000));
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity
      const emailToken = generateSignedToken(normalizedEmail, generatedCode, expiresAt);

      otpStore.set(normalizedEmail, { code: generatedCode, expiresAt });

      // Save to PostgreSQL if available
      try {
        await db.query(`DELETE FROM email_otps WHERE email = $1`, [normalizedEmail]);
        await db.query(
          `INSERT INTO email_otps (email, code, expires_at) VALUES ($1, $2, $3)`,
          [normalizedEmail, generatedCode, expiresAt]
        );
      } catch (dbErr) {
        // Non-blocking: signed token guarantees serverless verification even without DB
      }

      const config = getDynamicMailConfig(clientMailConfig);

      // If mail account is configured, dispatch automated email via Nodemailer
      if (config.user && config.pass) {
        try {
          const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.port === 465,
            auth: {
              user: config.user,
              pass: config.pass,
            },
            tls: {
              rejectUnauthorized: false,
            },
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 10000,
          });

          const emailHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 24px; color: #2D2422; }
                  .container { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
                  .header { background: #8B2500; padding: 28px 24px; text-align: center; color: #FFFFFF; }
                  .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
                  .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
                  .content { padding: 32px 28px; text-align: center; }
                  .code-box { display: inline-block; background: #FFF5F2; border: 2px dashed #8B2500; border-radius: 12px; padding: 16px 36px; margin: 24px 0; }
                  .code-text { font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #8B2500; margin: 0; font-family: monospace; }
                  .info { font-size: 13.5px; line-height: 1.6; color: #4B5563; margin: 0 0 16px; }
                  .warning { font-size: 11.5px; color: #9CA3AF; margin-top: 24px; border-top: 1px solid #F3F4F6; padding-top: 16px; }
                  .footer { background: #F9FAFB; padding: 16px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #E5E7EB; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>☕ FoodiesCafe</h1>
                    <p>Authentic Dining & Express Takeaway</p>
                  </div>
                  <div class="content">
                    <h2 style="margin: 0 0 8px; font-size: 18px; color: #1F2937;">Your Login Verification Code</h2>
                    <p class="info">
                      Please enter the verification code below to sign in to your FoodiesCafe account. This code is valid for <strong>5 minutes</strong>.
                    </p>
                    <div class="code-box">
                      <div class="code-text">${generatedCode}</div>
                    </div>
                    <p class="info" style="font-size: 12.5px;">
                      If you did not request this login code, you can safely ignore this email.
                    </p>
                    <div class="warning">
                      🔒 Never share this code with anyone. FoodiesCafe staff will never ask for your verification code.
                    </div>
                  </div>
                  <div class="footer">
                    FoodiesCafe Pakistan · Gulberg Lahore · F-7 Islamabad · Clifton Karachi<br/>
                    Sent via cafe automated dispatch from ${config.user}
                  </div>
                </div>
              </body>
            </html>
          `;

          // Asynchronously dispatch email in background for instant <20ms response time
          transporter
            .sendMail({
              from: config.from,
              to: normalizedEmail,
              subject: `${generatedCode} is your FoodiesCafe verification code`,
              html: emailHtml,
            })
            .then(() => {
              console.log(`[FoodiesCafe Mail Auth] Automated email successfully dispatched from ${config.user} to ${normalizedEmail}`);
            })
            .catch((smtpError: any) => {
              console.error('[FoodiesCafe Mail Auth] Background SMTP delivery error:', smtpError?.message || smtpError);
            });

          return NextResponse.json({
            success: true,
            isRealEmailSent: true,
            emailToken,
            devCode: process.env.NODE_ENV !== 'production' ? generatedCode : undefined,
            sender: config.user,
            message: `Verification code sent to ${normalizedEmail} from ${config.user}. Please check your inbox.`,
          });
        } catch (smtpError: any) {
          console.error('[FoodiesCafe Mail Auth] SMTP Error sending email:', smtpError);
          let friendlyError = smtpError.message || 'SMTP server error.';
          if (smtpError.code === 'EAUTH' || friendlyError.includes('BadCredentials')) {
            friendlyError =
              'Google / SMTP Authentication Failed: Please verify your 16-character App Password.';
          }

          return NextResponse.json({
            success: true,
            isRealEmailSent: false,
            isDevMode: true,
            emailToken,
            devCode: generatedCode,
            mailError: friendlyError,
            message: friendlyError,
          });
        }
      }

      // No mail account configured yet: Dev / Demo Simulation Mode
      console.log('=====================================================');
      console.log(`[FoodiesCafe Mail Auth] Verification Code for ${normalizedEmail}:`);
      console.log(`                >>>  ${generatedCode}  <<<`);
      console.log('To send real automated emails from your account to EVERYONE:');
      console.log('1. Get a 16-character Google App Password at https://myaccount.google.com/apppasswords');
      console.log('2. Set MAIL_ACCOUNT_USER and MAIL_ACCOUNT_KEY in .env');
      console.log('=====================================================');

      return NextResponse.json({
        success: true,
        isRealEmailSent: false,
        isDevMode: true,
        emailToken,
        devCode: generatedCode,
        noKeyFound: true,
        message: `No mail account configured in .env. Using demo preview code: ${generatedCode}.`,
      });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error: any) {
    console.error('[FoodiesCafe Mail Auth] Server exception:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error processing email verification.' },
      { status: 500 }
    );
  }
}
