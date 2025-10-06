// test-send.js
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set in environment. Set it to test sending via Resend.');
    process.exit(1);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const resp = await resend.emails.send({
      from: `TaHanap <${process.env.RESEND_FROM || 'no-reply@example.com'}>`,
      to: process.env.EMAIL_TEST_TO || process.env.RESEND_TO || process.env.RESEND_FROM || process.env.EMAIL_USER,
      subject: 'TaHanap test email (Resend)',
      html: '<b>This is a test from TaHanap backend using Resend.</b>',
    });
    console.log('Test email sent via Resend:', resp);
  } catch (err) {
    console.error('Test email failed (Resend):', err);
    process.exit(1);
  }
}

run();