import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  landlord: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, default: '' },
  status: { type: String, enum: ['Pending','Approved','Rejected'], default: 'Pending', index: true },
  createdAt: { type: Date, default: Date.now },
  actedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('Application', applicationSchema);
