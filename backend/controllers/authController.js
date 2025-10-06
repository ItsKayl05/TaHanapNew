import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = generateOTP();
    const otpExpiration = Date.now() + 10 * 60 * 1000;

    const mailOptions = {
      from: `"TaHanap" <${process.env.EMAIL_USER}>`,
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

    transporter.sendMail(mailOptions, async (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ msg: 'Error sending OTP email' });
      }

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
      console.log('Email sent:', info.response);
      res.status(201).json({ msg: 'OTP sent to email, please verify your email.' });
    });

  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// **Verify OTP**
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const lowerEmail = email.toLowerCase();

  try {
    const user = await User.findOne({ email: lowerEmail });

    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    if (user.otpExpiration < Date.now()) {
      return res.status(400).json({ msg: 'OTP expired' });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ msg: 'Invalid OTP' });
    }

    user.emailVerified = true;
    user.otp = undefined;
    user.otpExpiration = undefined;
    await user.save();

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

    transporter.sendMail({
      from: `"TaHanap" <${process.env.EMAIL_USER}>`,
      to: lowerEmail,
      subject: 'Resend OTP - TaHanap',
      html: `
        <div style="max-width:500px;margin:auto;padding:22px 24px 26px;font-family:Arial,sans-serif;border:1px solid #e2e8f0;border-radius:16px;background:#0f172a;color:#f1f5f9;">
          <h2 style="margin:0 0 4px;font-size:20px;background:linear-gradient(90deg,#38bdf8,#6366f1);-webkit-background-clip:text;color:transparent;">TaHanap</h2>
          <p style="margin:0 0 14px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#94a3b8;">Hanap-Bahay Made Simple</p>
          <p style="font-size:14px;line-height:1.5;margin:0 0 12px;color:#cbd5e1;">Here is your new verification OTP. It expires in <strong>2 minutes</strong>.</p>
          <div style="font-size:28px;font-weight:700;letter-spacing:6px;text-align:center;padding:12px;background:linear-gradient(135deg,#6366f1,#3b82f6);color:#fff;border-radius:12px;font-family:'Courier New',monospace;margin:0 0 14px;">${newOtp}</div>
          <p style="font-size:11px;text-align:center;color:#64748b;margin:0;">If this wasn’t you, you can ignore this email.</p>
        </div>
      `,
    });

    res.status(200).json({ msg: 'New OTP sent successfully.' });

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
      from: `"TaHanap" <${process.env.EMAIL_USER}>`,
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

    await transporter.sendMail(mailOptions);
    res.status(200).json({ msg: 'OTP sent to email' });

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
