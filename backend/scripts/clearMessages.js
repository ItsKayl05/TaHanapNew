import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Message from '../models/Message.js';

dotenv.config();

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI not set in environment.');
  process.exit(1);
}

const run = async () => {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB.');
    const count = await Message.countDocuments();
    console.log('Messages before delete:', count);
    const res = await Message.deleteMany({});
    console.log('Deleted count:', res.deletedCount);
    const after = await Message.countDocuments();
    console.log('Messages after delete:', after);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error clearing messages:', err);
    process.exit(1);
  }
};

run();
