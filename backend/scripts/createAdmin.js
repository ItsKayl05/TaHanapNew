import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_ENV = ['MONGO_URI'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const mongoUri = process.env.MONGO_URI;
console.log('➡️  Starting admin creation script');
console.log('🔗 MONGO_URI (sanitized):', mongoUri.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@'));

const createAdmin = async () => {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log('✅ Connected. DB Name:', mongoose.connection.name);

    // Show collection names (helps ensure connection context)
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('📦 Existing collections:', collections.map(c => c.name).join(', ') || '(none)');
    } catch (cErr) {
      console.warn('⚠️ Could not list collections:', cErr.message);
    }

    console.log('🔍 Checking for existing admin user...');
    const existingAdmin = await User.findOne({ username: 'admin' });
    if (existingAdmin) {
      console.log('ℹ️ Admin user already exists (id:', existingAdmin._id.toString() + ')');
      await mongoose.disconnect();
      console.log('🔚 Done');
      return;
    }

    console.log('🛠  Creating new admin user...');
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = process.env.ADMIN_INITIAL_PASSWORD || 'TAHANAPadmin';
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    const adminUser = new User({
      username: process.env.ADMIN_INITIAL_USERNAME || 'admin',
      email: process.env.ADMIN_INITIAL_EMAIL || 'admin@tahanap.com',
      password: hashedPassword,
      role: 'admin',
      emailVerified: true,
      contactNumber: '0000000000'
    });

    await adminUser.save();
    console.log('🎉 Admin user created successfully (id:', adminUser._id.toString() + ')');
    if (!process.env.ADMIN_INITIAL_PASSWORD) {
      console.log('🔐 Default password used: TAHANAPadmin (change immediately in production or set ADMIN_INITIAL_PASSWORD env var before running script)');
    } else {
      console.log('🔐 Admin password was provided via ADMIN_INITIAL_PASSWORD env var.');
    }
    await mongoose.disconnect();
    console.log('🔚 Done');
  } catch (error) {
    console.error('❌ Error creating admin user:');
    if (error.name === 'MongoServerError') {
      console.error('MongoServerError code:', error.code, 'message:', error.message);
    } else if (error.name === 'MongooseServerSelectionError') {
      console.error('Server selection error – possible network / IP whitelist / wrong URI.');
    }
    console.error(error);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
};

createAdmin();