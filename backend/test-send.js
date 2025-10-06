// test-send.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function run() {
  try {
    const info = await transporter.sendMail({
      from: `"TaHanap Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TEST_TO || process.env.EMAIL_USER,
      subject: 'TaHanap test email',
      text: 'This is a test from TaHanap backend.',
      html: '<b>This is a test from TaHanap backend.</b>',
    });
    console.log('Test email sent:', info.response || info);
  } catch (err) {
    console.error('Test email failed:', err);
  }
}

run();