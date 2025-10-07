import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { validationResult } from 'express-validator';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Default sender address for Resend if RESEND_FROM is not set.
// Use Resend's official free onboarding sender so the free plan can send without verifying a custom domain.
const DEFAULT_RESEND_FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';

// We removed Nodemailer/SMTP support. Resend is now the required email provider.
// Initialize Resend client if API key is present
// Initialize Resend client (preferred email provider)
let resendClient = null;
try {
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log('[mail] Resend client initialized');
  }
} catch (e) {
  console.error('[mail] Failed to initialize Resend client:', e);
}

// Nodemailer transporter (SMTP) fallback/option
let transporter = null;
try {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  if (smtpHost && smtpPort) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: typeof process.env.SMTP_SECURE !== 'undefined' ? process.env.SMTP_SECURE === 'true' : smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
      },
    });
    console.log('[mail] SMTP transporter created');
  }
} catch (e) {
  console.warn('[mail] Failed to create SMTP transporter (will only use Resend if available):', e && e.message ? e.message : e);
}

// Initialize Resend client if API key is present
// Unified email sender: prefers Resend using the explicit Resend SDK format
// (from is taken from process.env.RESEND_FROM to match the requested format).
// Falls back to SMTP transporter only if Resend is not configured or fails and transporter exists.
// To force SMTP even when RESEND_API_KEY exists, set FORCE_SMTP=true in env.
const sendEmail = async ({ from, to, subject, html, text }) => {
  const useSmtp = !!process.env.FORCE_SMTP;

  // Use Resend if available and not forcing SMTP
  if (resendClient && !useSmtp) {
    try {
      // Force the 'from' to use RESEND_FROM env per requested format, fallback to DEFAULT_RESEND_FROM.
  // Use the RESEND_FROM env variable explicitly as requested
  const resp = await resendClient.emails.send({ from: process.env.RESEND_FROM, to, subject, html, text });
      lastMailStatus.provider = 'resend';
      lastMailStatus.lastSend = { ts: Date.now(), response: resp && (resp.id || resp.messageId) ? (resp.id || resp.messageId) : JSON.stringify(resp) };
      console.log('[mail] Sent via Resend:', lastMailStatus.lastSend.response);
      return { data: resp, error: null };
    } catch (err) {
      const errMsg = String(err && err.message ? err.message : err);
      lastMailStatus.lastError = errMsg;
      console.error('[mail] Resend send error:', err);

      // If Resend complains that the domain is not verified, retry using the default onboarding sender
      // This improves deliverability while the domain is being verified in Resend dashboard.
      if ((err && err.name === 'validation_error') || /not verified/i.test(errMsg) || /domain is not verified/i.test(errMsg)) {
        try {
          console.log('[mail] Retrying with onboarding sender due to domain verification error');
          const resp2 = await resendClient.emails.send({ from: DEFAULT_RESEND_FROM, to, subject, html, text });
          lastMailStatus.provider = 'resend (onboarding)';
          lastMailStatus.lastSend = { ts: Date.now(), response: resp2 && (resp2.id || resp2.messageId) ? (resp2.id || resp2.messageId) : JSON.stringify(resp2) };
          console.log('[mail] Sent via Resend (onboarding):', lastMailStatus.lastSend.response);
          return { data: resp2, error: null };
        } catch (err2) {
          lastMailStatus.lastError = String(err2 && err2.message ? err2.message : err2);
          console.error('[mail] Resend retry (onboarding) failed:', err2);
          // fallthrough to try SMTP if available
        }
      }
      // fallthrough to try SMTP if available
    }
  }

  // SMTP fallback (if configured)
  if (transporter) {
    try {
      const info = await transporter.sendMail({ from: from || process.env.RESEND_FROM || DEFAULT_RESEND_FROM, to, subject, html, text });
      lastMailStatus.provider = 'smtp';
      lastMailStatus.lastSend = { ts: Date.now(), response: info && (info.response || info.messageId) ? (info.response || info.messageId) : JSON.stringify(info) };
      console.log('[mail] Sent via SMTP:', lastMailStatus.lastSend.response);
      return { data: info, error: null };
    } catch (err) {
      lastMailStatus.lastError = String(err && err.message ? err.message : err);
      console.error('[mail] SMTP send error:', err);
      return { data: null, error: err };
    }
  }

  const err = new Error('No email provider configured (RESEND_API_KEY or SMTP settings required)');
  lastMailStatus.lastError = err.message;
  console.error('[mail] sendEmail failed:', err.message);
  return { data: null, error: err };
};

// In-memory last mail status for debugging (not persisted)
let lastMailStatus = {
  provider: resendClient ? 'resend' : null,
  lastSend: null,
  lastError: null,
};

// Function to generate a random 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Add this to your authController.js
export const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  // Input validation
  if (!username || !password) {
    return res.status(400).json({ msg: 'Please provide both username and password' });
  }

  try {
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ 
        msg: 'Access denied. Admin privileges required.' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        id: user._id,
        role: user.role,
        username: user.username,
        tokenVersion: user.tokenVersion || 0
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({ 
      msg: 'Admin login successful', 
      token,
      role: user.role
    });

  } catch (err) {
    console.error('Error during admin login:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// **Admin Change Password (authenticated)**
export const changeAdminPassword = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ msg: 'Both oldPassword and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ msg: 'New password must be at least 8 characters' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ msg: 'Admin not found' });
    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(401).json({ msg: 'Old password is incorrect' });
    if (oldPassword === newPassword) {
      return res.status(400).json({ msg: 'New password must be different from old password' });
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    // Increment token version to invalidate existing tokens
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    res.json({ msg: 'Password updated successfully. Please log in again.' });
  } catch (err) {
    console.error('Error changing admin password:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// **Login User**
export const loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  const lowerEmail = email.toLowerCase();

  try {
    const user = await User.findOne({ email: lowerEmail });
    if (!user) {
      return res.status(401).json({ msg: 'Invalid credentials' });  // 401 = Unauthorized
    }

    if (!user.emailVerified) {
      return res.status(403).json({ msg: 'Please verify your email before logging in' }); // 403 = Forbidden
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: 'Invalid credentials' });  // 401 = Unauthorized
    }

  const token = jwt.sign({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ 
      msg: 'Login successful', 
      token, 
      role: user.role // ✅ FIXED: Sends role for frontend redirection 
    });

  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// **Register User**
export const registerUser = async (req, res) => {
  console.log('Register request received:', req.body); // Log incoming request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array()); // Log validation errors
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, fullName, address, password, role, contactNumber } = req.body;
  const lowerEmail = email.toLowerCase();

  try {
    let user = await User.findOne({ email: lowerEmail });

    // If user exists but email is not verified, delete the old record
    if (user && !user.emailVerified) {
      console.log('Deleting unverified user:', user.email); // Log deletion
      await User.deleteOne({ email: lowerEmail });
      user = null; // Reset user to allow registration
    }

    if (user) {
      console.log('User already exists:', user.email); // Log existing user
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Rest of the registration logic...
  // Use configurable bcrypt cost to speed up registration when needed
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '8', 10);
  const salt = await bcrypt.genSalt(saltRounds);
  const hashedPassword = await bcrypt.hash(password, salt);
    const otp = generateOTP();
    const otpExpiration = Date.now() + 10 * 60 * 1000;

    const mailOptions = {
      // Ensure the from is taken from env as requested
      from: process.env.RESEND_FROM,
      to: lowerEmail,
      subject: 'Email Verification - TaHanap',
      html: `
        <div style="max-width:520px;margin:auto;padding:24px 26px 30px;font-family:Arial,Helvetica,sans-serif;border:1px solid #e2e8f0;border-radius:18px;background:#0f172a;color:#f1f5f9;">
          <div style="text-align:center;margin-bottom:12px;">
            <h1 style="margin:0;font-size:22px;letter-spacing:.5px;background:linear-gradient(90deg,#38bdf8,#6366f1,#3b82f6);-webkit-background-clip:text;color:transparent;">TaHanap</h1>
            <p style="margin:4px 0 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;">Hanap-Bahay Made Simple</p>
          </div>
          <h2 style="margin:18px 0 10px;font-size:18px;font-weight:600;color:#f1f5f9;">Hello, ${username}!</h2>
          <p style="font-size:14px;line-height:1.5;color:#cbd5e1;margin:0 0 14px;">Use the One-Time Passcode below to verify your email address. For your security it expires in <strong>2 minutes</strong>.</p>
          <div style="font-size:30px;font-weight:700;letter-spacing:6px;text-align:center;padding:14px 10px;margin:0 0 14px;background:linear-gradient(135deg,#6366f1,#3b82f6);color:#fff;border-radius:14px;font-family:'Courier New',monospace;">${otp}</div>
          <p style="font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;margin:0 0 18px;">Didn’t request this? You can safely ignore this email.</p>
          <p style="font-size:11px;line-height:1.4;color:#64748b;text-align:center;margin:0;">&copy; ${new Date().getFullYear()} TaHanap. Building trusted rentals for Filipinos.</p>
        </div>
      `,
    };

    try {
      // Create the user record regardless of email sending outcome so the flow can continue
      user = new User({
        username,
        email: lowerEmail,
        fullName,
        address,
        password: hashedPassword,
        role: role.toLowerCase(),
        contactNumber,
        otp,
        otpExpiration,
        emailVerified: false,
      });

      await user.save();
      console.log('User created for registration:', user.email);

      // If Resend is not configured, return helpful response
      const emailConfigured = !!process.env.RESEND_API_KEY;

      if (!emailConfigured) {
        console.warn('RESEND_API_KEY not configured on server. Registration created but OTP not delivered.');
        lastMailStatus.lastError = 'RESEND_API_KEY not configured on server';
        return res.status(201).json({ msg: 'Registration created but OTP could not be sent because email provider is not configured. Contact admin to enable email delivery.', emailQueued: false, emailConfigured: false });
      }

      // Send email asynchronously so registration returns immediately to the client.
      // Use unified sender (Resend or Nodemailer)
  // Use unified sendEmail helper which prefers Resend and uses RESEND_FROM
  sendEmail({ to: mailOptions.to, subject: mailOptions.subject, html: mailOptions.html })
        .then(info => {
          lastMailStatus.lastSend = { ts: Date.now(), response: info && (info.response || info.id || JSON.stringify(info)) };
          console.log('Email sent (async):', lastMailStatus.lastSend.response);
        })
        .catch(mailErr => {
          lastMailStatus.lastError = String(mailErr && mailErr.message ? mailErr.message : mailErr);
          console.error('Async email send error:', mailErr);
        });

      // Return immediately; email sending is queued in background
      return res.status(201).json({ msg: 'OTP processing started. Check your email shortly.', emailQueued: true });

    } catch (err) {
      console.error('Error during registration flow (saving user / sending email):', err);
      return res.status(500).json({ msg: 'Server error' });
    }

  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// **Verify OTP**
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const lowerEmail = email.toLowerCase();

  // Debug logging for verification attempts (mask OTP for safety)
  try {
    const masked = otp ? `***${otp.slice(-2)}` : 'no-otp';
    console.log(`verifyOtp: attempt for email=${lowerEmail}, otp=${masked}`);
  } catch (logErr) {
    console.warn('verifyOtp: could not mask OTP for logging');
  }

  try {
    const user = await User.findOne({ email: lowerEmail });

    if (!user) {
      console.warn(`verifyOtp: user not found for ${lowerEmail}`);
      return res.status(400).json({ msg: 'User not found' });
    }

    if (!user.otp || user.otpExpiration < Date.now()) {
      console.warn(`verifyOtp: OTP expired or missing for ${lowerEmail}. otpExpiration=${user.otpExpiration}`);
      return res.status(400).json({ msg: 'OTP expired' });
    }

    // Compare as strings to avoid type coercion issues
    if (String(user.otp) !== String(otp)) {
      const maskedStored = user.otp ? `***${String(user.otp).slice(-2)}` : 'no-otp';
      console.warn(`verifyOtp: OTP mismatch for ${lowerEmail}. provided=${otp ? `***${String(otp).slice(-2)}` : 'no-otp'}, stored=${maskedStored}`);
      return res.status(400).json({ msg: 'Invalid OTP' });
    }

    user.emailVerified = true;
    user.otp = undefined;
    user.otpExpiration = undefined;
    await user.save();

    console.log(`verifyOtp: success for ${lowerEmail}`);
    res.status(200).json({ msg: 'Email successfully verified!' });

  } catch (err) {
    console.error('Error during OTP verification:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// **Resend OTP**
export const resendOtp = async (req, res) => {
  const { email } = req.body;
  const lowerEmail = email.toLowerCase();

  try {
    const user = await User.findOne({ email: lowerEmail });

    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ msg: 'User already verified' });
    }

    const newOtp = generateOTP();
    user.otp = newOtp;
    user.otpExpiration = Date.now() + 10 * 60 * 1000;
    await user.save();

    // send via Resend
    try {
      await sendEmail({ to: lowerEmail, subject: 'Resend OTP - TaHanap', html: `
        <div style="max-width:520px;margin:auto;padding:24px 26px 30px;font-family:Arial,Helvetica,sans-serif;border:1px solid #e2e8f0;border-radius:18px;background:#0f172a;color:#f1f5f9;">
          <h1 style="margin:0;font-size:22px;letter-spacing:.5px;background:linear-gradient(90deg,#38bdf8,#6366f1,#3b82f6);-webkit-background-clip:text;color:transparent;">TaHanap</h1>
          <p style="margin:4px 0 16px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;">Hanap-Bahay Made Simple</p>
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#f1f5f9;">Your One-Time Passcode</h2>
          <div style="font-size:30px;font-weight:700;letter-spacing:6px;text-align:center;padding:14px 10px;margin:0 0 14px;background:linear-gradient(135deg,#6366f1,#3b82f6);color:#fff;border-radius:14px;font-family:'Courier New',monospace;">${newOtp}</div>
          <p style="font-size:11px;line-height:1.4;color:#64748b;text-align:center;margin:0;">If you didn't request this, you can ignore this email.</p>
        </div>
      ` });
      res.status(200).json({ msg: 'New OTP sent successfully.' });
    } catch (err) {
      res.status(500).json({ msg: 'Failed to send OTP email', error: String(err) });
    }

  } catch (err) {
    console.error('Error resending OTP:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// **Send OTP for Reset**
export const sendOtpForReset = async (req, res) => {
  const { email } = req.body;
  const lowerEmail = email.toLowerCase();

  try {
    const user = await User.findOne({ email: lowerEmail });

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiration = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
    await user.save();

    // Send email with OTP
    const mailOptions = {
      from: process.env.RESEND_FROM,
      to: lowerEmail,
      subject: 'Password Reset OTP - TaHanap',
      html: `
        <div style="max-width:520px;margin:auto;padding:24px 26px 30px;font-family:Arial,Helvetica,sans-serif;border:1px solid #e2e8f0;border-radius:18px;background:#0f172a;color:#f1f5f9;">
          <h1 style="margin:0;font-size:22px;letter-spacing:.5px;background:linear-gradient(90deg,#38bdf8,#6366f1,#3b82f6);-webkit-background-clip:text;color:transparent;">TaHanap</h1>
          <p style="margin:4px 0 16px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;">Hanap-Bahay Made Simple</p>
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#f1f5f9;">Password Reset Request</h2>
            <p style="font-size:14px;line-height:1.5;color:#cbd5e1;margin:0 0 14px;">Enter the OTP below to reset your password. It expires in <strong>2 minutes</strong>.</p>
            <div style="font-size:30px;font-weight:700;letter-spacing:6px;text-align:center;padding:14px 10px;margin:0 0 14px;background:linear-gradient(135deg,#6366f1,#3b82f6);color:#fff;border-radius:14px;font-family:'Courier New',monospace;">${otp}</div>
            <p style="font-size:11px;line-height:1.4;color:#64748b;text-align:center;margin:0;">If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    };

    try {
      await sendEmail({ to: mailOptions.to, subject: mailOptions.subject, html: mailOptions.html });
      res.status(200).json({ msg: 'OTP sent to email' });
    } catch (err) {
      console.error('Error sending OTP (reset):', err);
      res.status(500).json({ msg: 'Error sending OTP' });
    }

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// **Verify OTP and Reset Password**
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const lowerEmail = email.toLowerCase();

  // Validate password strength before proceeding
  if (newPassword.length < 6) {
    return res.status(400).json({ msg: 'Password must be at least 6 characters' });
  }

  try {
    const user = await User.findOne({ email: lowerEmail });

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (!user.otp || user.otpExpiration < Date.now()) {
      return res.status(400).json({ msg: 'OTP expired or invalid' });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ msg: 'Incorrect OTP' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.otp = undefined;
    user.otpExpiration = undefined;

    await user.save();
    res.status(200).json({ msg: 'Password reset successful' });

  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Export a getter for lastMailStatus for admin debugging routes
export const lastMailStatusGetter = () => ({ ...lastMailStatus });
