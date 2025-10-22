import mongoose from 'mongoose';

const PaymentSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  paid: { type: Boolean, default: false },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
  paidAt: { type: Date }
});

export default mongoose.model('PaymentSession', PaymentSessionSchema);
