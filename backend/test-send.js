// test-send.js
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Resend client (matches requested pattern)
const resend = new Resend(process.env.RESEND_API_KEY);

async function tryResend(to) {
  if (!process.env.RESEND_API_KEY) return { data: null, error: new Error('RESEND_API_KEY not set') };
  try {
    // Compose friendly sender header if env parts provided
    const fromName = process.env.RESEND_FROM_NAME || 'Tahanap';
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM || 'noreply@tahanap.xyz';
    const fromHeader = `${fromName} <${fromEmail}>`;

    const data = await resend.emails.send({
      from: fromHeader,
      to,
      subject: 'TaHanap test email (Resend)',
      html: '<b>This is a test from TaHanap backend using Resend.</b>',
    });
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

async function trySmtp(to) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  if (!smtpHost || !smtpPort) return { data: null, error: new Error('SMTP not configured') };

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: typeof process.env.SMTP_SECURE !== 'undefined' ? process.env.SMTP_SECURE === 'true' : smtpPort === 465,
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
  from: process.env.SMTP_USER || process.env.RESEND_FROM || 'onboarding@resend.dev',
      to,
      subject: 'TaHanap test email (SMTP)',
      html: '<b>This is a test from TaHanap backend using SMTP.</b>',
    });
    return { data: info, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

async function run() {
  const to = process.env.EMAIL_TEST_TO || process.env.RESEND_TO || process.env.RESEND_FROM || process.env.EMAIL_USER;

  console.log('Trying Resend...');
  const r = await tryResend(to);
  if (!r.error) {
    console.log('Resend success:', r.data);
    return;
  }
  console.warn('Resend failed:', r.error && r.error.message ? r.error.message : r.error);

  console.log('Trying SMTP fallback...');
  const s = await trySmtp(to);
  if (!s.error) {
    console.log('SMTP success:', s.data);
    return;
  }
  console.error('Both Resend and SMTP failed:', { resend: r.error && r.error.message ? r.error.message : r.error, smtp: s.error && s.error.message ? s.error.message : s.error });
  process.exit(1);
}

run();