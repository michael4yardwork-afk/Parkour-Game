/**
 * Email sending utility using nodemailer.
 *
 * Configure via environment variables:
 *   SMTP_HOST   — SMTP server hostname (e.g. smtp.gmail.com, smtp.resend.com)
 *   SMTP_PORT   — SMTP port (default 587)
 *   SMTP_SECURE — set to "true" for port 465 TLS (default false)
 *   SMTP_USER   — SMTP username / login
 *   SMTP_PASS   — SMTP password or app password
 *   SMTP_FROM   — "From" address shown in emails (e.g. "Delta Rush <no-reply@deltarush.win>")
 *
 * When SMTP credentials are absent the module exports isConfigured=false and
 * sendMail resolves immediately without throwing, so callers can fall back
 * gracefully (e.g. to Supabase's built-in email).
 */

import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

export const isConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(opts: MailOptions): Promise<void> {
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping sendMail.');
    return;
  }
  await transporter.sendMail({
    from: SMTP_FROM ?? SMTP_USER,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}
