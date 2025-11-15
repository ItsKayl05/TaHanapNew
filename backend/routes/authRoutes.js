import express from 'express';
import { check } from 'express-validator';
import {
  loginUser,
  registerUser,
  verifyOtp,
  resendOtp,
  sendOtpForReset,
  resetPassword, 
  adminLogin,
  changeAdminPassword
} from '../controllers/authController.js';
import { protect, roleCheck } from '../middleware/authMiddleware.js';

const router = express.Router();

// Login Route
router.post('/login', [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists(),
], loginUser);

// Register Route with OTP verification
router.post('/register', [
  check('username', 'Username is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
], registerUser);

// OTP Verification Route
router.post('/verify-otp', verifyOtp);

// Resend OTP Route
router.post('/resend-otp', resendOtp);

router.post('/forgot-password', sendOtpForReset);
router.post('/reset-password', resetPassword);

router.post('/admin/login', adminLogin);
router.post('/admin/change-password', protect, roleCheck('admin'), changeAdminPassword);

export default router;
