import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { 
        type: String, 
        required: function() {
            return !this.attachments || this.attachments.length === 0;
        }, 
        trim: true, 
        maxlength: 5000 
    },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    read: { type: Boolean, default: false },
    messageType: {
        type: String,
        enum: ['text', 'image', 'file', 'mixed'],
        default: 'text'
    },
    attachments: [{
        url: { type: String, required: true },
        originalName: { type: String, required: true },
        publicId: { type: String, required: true },
        fileType: { 
            type: String, 
            enum: ['image', 'video', 'document', 'other'],
            required: true 
        },
        size: Number,
        width: Number, // for images/videos
        height: Number // for images/videos
    }]
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for determining if message has attachments
MessageSchema.virtual('hasAttachments').get(function() {
    return this.attachments && this.attachments.length > 0;
});

// Pre-save middleware to set messageType
MessageSchema.pre('save', function(next) {
    const hasContent = this.content && this.content.trim().length > 0;
    const hasAttachments = this.attachments && this.attachments.length > 0;
    
    if (hasContent && hasAttachments) {
        this.messageType = 'mixed';
    } else if (hasAttachments) {
        // Determine type based on first attachment
        this.messageType = this.attachments[0].fileType === 'image' ? 'image' : 'file';
    } else {
        this.messageType = 'text';
    }
    next();
});

// Index for better performance
MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
MessageSchema.index({ receiver: 1, read: 1 });

export default mongoose.model('Message', MessageSchema);