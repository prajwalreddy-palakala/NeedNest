const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// ─── In-memory OTP store { email: { otp, expiresAt, data? } } ─────────────────
const otpStore = new Map();
// ─── In-memory Register OTP store ─────────────────────────────────────────────
const registerOtpStore = new Map();

// ─── Nodemailer transporter ────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'prajwalreddypalakala@gmail.com',
    pass: 'ioxr fumj sksm tocd'
  }
});

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ─── OTP email helper ──────────────────────────────────────────────────────────
const sendOtpEmail = async (email, otp, subject, heading) => {
  await transporter.sendMail({
    from: '"NeedNest" <prajwalreddypalakala@gmail.com>',
    to: email,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#0f172a;color:#f8fafc;border-radius:12px;">
        <h2 style="color:#10b981;margin-bottom:8px;">NeedNest — ${heading}</h2>
        <p style="color:#94a3b8;margin-bottom:24px;">Use the OTP below to verify your email. It expires in <strong style="color:#f8fafc;">10 minutes</strong>.</p>
        <div style="background:#1e293b;border:2px solid #10b981;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:2.5rem;font-weight:800;letter-spacing:12px;color:#10b981;">${otp}</span>
        </div>
        <p style="color:#64748b;font-size:0.85rem;">If you didn't request this, ignore this email.</p>
      </div>
    `
  });
};

// @route   POST /api/auth/send-register-otp
// @desc    Send OTP to email for registration verification
// @access  Public
router.post('/send-register-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Check if email already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    registerOtpStore.set(email, { otp, expiresAt });

    await sendOtpEmail(
      email,
      otp,
      '🔐 NeedNest — Verify Your Email',
      'Email Verification OTP'
    );

    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Send register OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});

// @route   POST /api/auth/verify-register-otp
// @desc    Verify OTP for registration before form submission
// @access  Public
router.post('/verify-register-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const record = registerOtpStore.get(email);
    if (!record) {
      return res.status(400).json({ message: 'No OTP found. Please request a new OTP.' });
    }
    if (Date.now() > record.expiresAt) {
      registerOtpStore.delete(email);
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }
    if (record.otp !== otp.toString()) {
      return res.status(400).json({ message: 'Invalid OTP. Please check and try again.' });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify register OTP error:', error);
    res.status(500).json({ message: 'Failed to verify OTP. Please try again.' });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new user (requires OTP verification)
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, location, userType, otp } = req.body;

    // Verify OTP
    if (!otp) {
      return res.status(400).json({ message: 'OTP is required' });
    }
    const record = registerOtpStore.get(email);
    if (!record) {
      return res.status(400).json({ message: 'No OTP found. Please request a new OTP.' });
    }
    if (Date.now() > record.expiresAt) {
      registerOtpStore.delete(email);
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }
    if (record.otp !== otp.toString()) {
      return res.status(400).json({ message: 'Invalid OTP. Please check and try again.' });
    }

    // OTP valid — clear it
    registerOtpStore.delete(email);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Validate location
    if (!location || !location.city || !location.state) {
      return res.status(400).json({ message: 'City and state are required' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password,
      userType: userType || 'both',
      location: {
        city: location.city,
        state: location.state,
        address: location.address || '',
        pincode: location.pincode || ''
      }
    });

    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      role: user.role,
      userType: user.userType,
      itemsDonated: user.itemsDonated,
      itemsReceived: user.itemsReceived,
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: error.message || 'Server error during registration' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check user exists and get password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account has been deactivated. Contact admin.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      role: user.role,
      userType: user.userType,
      itemsDonated: user.itemsDonated,
      itemsReceived: user.itemsReceived,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      role: user.role,
      userType: user.userType,
      itemsDonated: user.itemsDonated,
      itemsReceived: user.itemsReceived,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = req.body.name || user.name;
    user.phone = req.body.phone || user.phone;

    if (req.body.location) {
      user.location = {
        city: req.body.location.city || user.location.city,
        state: req.body.location.state || user.location.state,
        address: req.body.location.address || user.location.address,
        pincode: req.body.location.pincode || user.location.pincode
      };
    }

    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      location: updatedUser.location,
      role: updatedUser.role,
      userType: updatedUser.userType,
      itemsDonated: updatedUser.itemsDonated,
      itemsReceived: updatedUser.itemsReceived
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Generate OTP and send to user's email
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found with this email' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpStore.set(email, { otp, expiresAt });

    await sendOtpEmail(
      email,
      otp,
      '🔐 NeedNest — Your Password Reset OTP',
      'Password Reset OTP'
    );

    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to send OTP. Try again.' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Verify OTP and reset password
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    const record = otpStore.get(email);
    if (!record) return res.status(400).json({ message: 'No OTP found. Please request a new one.' });
    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }
    if (record.otp !== otp.toString()) {
      return res.status(400).json({ message: 'Invalid OTP. Please check and try again.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = newPassword;
    await user.save();

    otpStore.delete(email);

    res.json({ message: 'Password reset successfully! You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
});

// @route   POST /api/auth/dev-register
// @desc    DEV ONLY - Register without OTP (remove before production)
// @access  Public
router.post('/dev-register', async (req, res) => {
  try {
    const { name, email, phone, password, location, userType } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      await User.deleteOne({ email });
    }
    const user = await User.create({
      name, email, phone, password,
      userType: userType || 'both',
      location: {
        city: location.city,
        state: location.state,
        address: location.address || '',
        pincode: location.pincode || ''
      }
    });
    const token = generateToken(user._id);
    res.status(201).json({ success: true, email: user.email, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

