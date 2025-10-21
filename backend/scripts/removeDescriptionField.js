import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Property from '../models/Property.js';

dotenv.config();

const REQUIRED_ENV = ['MONGO_URI'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const mongoUri = process.env.MONGO_URI;

const run = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log('Connected to', mongoose.connection.name);

    // Count documents that still have description
    const count = await Property.countDocuments({ description: { $exists: true, $ne: null, $ne: '' } });
    console.log(`Properties with non-empty description: ${count}`);
    if (count === 0) {
      console.log('No documents require update. Exiting.');
      await mongoose.disconnect();
      return;
    }

    const res = await Property.updateMany({ description: { $exists: true } }, { $unset: { description: "" } });
    console.log('updateMany result:', res);

    // Optional: ensure schema compatibility by also setting default empty string where needed
    // (not necessary since field removed from model)

    await mongoose.disconnect();
    console.log('Done. Disconnected.');
  } catch (err) {
    console.error('Migration failed:', err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
};

run();
