import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
	sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	content: { type: String, required: true, trim: true, maxlength: 5000 },
	property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' }, // optional contextual link
	read: { type: Boolean, default: false },
	// attachments stored as cloudinary secure URLs + metadata (no local filename)
	attachments: [{ url: String, originalName: String, publicId: String }]
}, { timestamps: true });

export default mongoose.model('Message', MessageSchema);