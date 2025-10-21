import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
    },
    // Option to show email address on public profile
    showEmailPublicly: {
        type: Boolean,
        default: false
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    fullName: {
        type: String,
        required: false,
        default: '',
    },
    address: {
        type: String,
        required: false,
        default: '',
    },
    barangay: {
        type: String,
        required: false,
        default: '',
    },
    contactNumber: { 
        type: String, 
        required: true, 
        trim: true 
    },
    password: {
        type: String,
        required: true,
    },
    profilePic: {
        type: String,
        default: '',
    },
    idDocuments: [{
        filename: { type: String },        // Stored file name
        originalName: { type: String },    // Original uploaded filename
        idType: { type: String },          // e.g., Passport, Driver's License
        status: {
            type: String,
            // Added 'accepted' (new term replacing legacy 'approved'). Keep both temporarily for backward compatibility.
            enum: ["pending", "accepted", "approved", "rejected"],
            default: "pending",
        },
        note: { type: String, default: '' },              // Admin internal note (latest)
        rejectionReason: { type: String, default: '' },   // Specific reason when rejected (latest)
        uploadedAt: { type: Date, default: Date.now },
        // Audit history of changes for this document
        history: [{
            // History also needs to allow 'accepted'.
            status: { type: String, enum: ["pending", "accepted", "approved", "rejected"] },
            note: String,
            rejectionReason: String,
            admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            changedAt: { type: Date, default: Date.now }
        }]
    }],  
    // Occupation field for public profile
    occupation: {
        type: String,
        default: ''
    },
    // Aggregate landlord verification status (true only when all required docs approved)
    landlordVerified: {
        type: Boolean,
        default: false
    },
    tokenVersion: {
        type: Number,
        default: 0
    },
    role: {
        type: String,
        enum: ['tenant', 'landlord', 'admin'],
        default: 'tenant',
    },
    tokens: [{
        token: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['active', 'banned'],
        default: 'active'
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    otp: {
        type: String,
    },
    otpExpiration: {
        type: Date,
    },
}, { timestamps: true });

// Hash OTP before saving
UserSchema.methods.setOtp = async function (otp) {
    const salt = await bcrypt.genSalt(10);
    this.otp = await bcrypt.hash(otp, salt);
};

// Compare OTP when verifying
UserSchema.methods.verifyOtp = async function (enteredOtp) {
    return await bcrypt.compare(enteredOtp, this.otp);
};

export default mongoose.model('User', UserSchema);