import fs from 'fs'; // Import fs module
import { uploadProfilePicMemory } from '../middleware/authMiddleware.js';
import User from "../models/User.js"; // Ensure correct path
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import Notification from "../models/Notification.js";

export const logout = async (req, res) => {
    try {
        // Remove the current token from the user's tokens array
        req.user.tokens = req.user.tokens.filter(tokenObj => {
            return tokenObj.token !== req.token;
        });
        
        await req.user.save();
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error logging out" });
    }
};

export const logoutAll = async (req, res) => {
    try {
        // Remove all tokens (log out from all devices)
        req.user.tokens = [];
        await req.user.save();
        res.status(200).json({ message: "Logged out from all devices" });
    } catch (error) {
        res.status(500).json({ message: "Error logging out" });
    }
};

// Admin functions
export const getUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: "Error fetching users" });
    }
};

export const banUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Clear all active sessions
        user.tokens = [];
        user.status = 'banned';
        await user.save();
        
        res.status(200).json({
            message: 'User banned and logged out from all devices',
            user: {
                _id: user._id,
                status: user.status
            }
        });
    } catch (error) {
        console.error('Error banning user:', error);
        res.status(500).json({ message: "Error banning user" });
    }
};

export const unbanUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.status = 'active';
        await user.save();
        
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "Error unbanning user" });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // If landlord, delete all their properties
        if (user.role === 'landlord') {
            const Property = (await import('../models/Property.js')).default;
            await Property.deleteMany({ landlord: user._id });
        }

        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'User and related properties deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: "Error deleting user" });
    }
};

// ✅ Fetch All Landlords for Verification
export const getLandlordsForVerification = async (req, res) => {
    try {
        const debug = req.query.debug === '1';
        // Only fetch landlords who are NOT yet verified (landlordVerified:false)
        // This ensures once accepted (verified) they disappear from the admin list immediately on next fetch.
        const query = {
            role: 'landlord',
            'idDocuments.0': { $exists: true },
            landlordVerified: false
        };
        const users = await User.find(query).select('-password');
        const enriched = users.map(u => ({
            ...u.toObject(),
            idDocuments: [...u.idDocuments]
                .map(d => {
                    // Normalize legacy 'approved' to 'accepted' (do not persist here)
                    if (d.status === 'approved') d.status = 'accepted';
                    return d;
                })
                .sort((a,b)=> new Date(a.uploadedAt) - new Date(b.uploadedAt)),
            _docCount: u.idDocuments.length,
            _pendingCount: u.idDocuments.filter(d => d.status === 'pending').length,
            _acceptedCount: u.idDocuments.filter(d => ['accepted','approved'].includes(d.status)).length,
            _rejectedCount: u.idDocuments.filter(d => d.status === 'rejected').length
        }));
        if (debug) {
            console.log('DEBUG getLandlordsForVerification matched count=', enriched.length);
            enriched.forEach(e => console.log(`Landlord ${e._id} docs=${e._docCount} pend=${e._pendingCount} acc=${e._acceptedCount} rej=${e._rejectedCount} verified=${e.landlordVerified}`));
            if (!enriched.length) {
                const totalWithDocs = await User.countDocuments({ role:'landlord','idDocuments.0': { $exists:true } });
                console.log('DEBUG no landlords returned. Landlords WITH any docs =', totalWithDocs);
            }
        }
        res.status(200).json(enriched);
    } catch (error) {
        console.error('Error fetching landlords for verification:', error);
        res.status(500).json({ message: 'Error fetching landlords for verification' });
    }
};

// ✅ Verify Landlord ID
export const verifyLandlordID = async (req, res) => {
    try {
        const { userId, approvals } = req.body;
        if (!Array.isArray(approvals) || approvals.length === 0) {
            return res.status(400).json({ message: 'Approvals array required' });
        }
        const user = await User.findById(userId);
        if (!user || user.role !== 'landlord') {
            return res.status(404).json({ message: 'Landlord not found' });
        }
        const wasVerified = user.landlordVerified;
        let anyRejected = false;
        approvals.forEach(a => {
            const doc = user.idDocuments.id(a.docId);
            if (!doc) return;
            if (!['accepted','approved','rejected','pending'].includes(a.status)) return;
            if (a.status === 'rejected' && !(a.rejectionReason && a.rejectionReason.trim())) return;
            const prevStatus = doc.status;
            doc.status = (a.status === 'approved') ? 'accepted' : a.status; // normalize
            if (typeof a.note === 'string') doc.note = a.note;
            if (doc.status === 'rejected') {
                doc.rejectionReason = a.rejectionReason.trim();
            } else {
                doc.rejectionReason = '';
            }
            if (prevStatus !== doc.status || a.note || (doc.status==='rejected')) {
                doc.history.push({
                    status: doc.status,
                    note: doc.note,
                    rejectionReason: doc.rejectionReason,
                    admin: req.user?._id,
                    changedAt: new Date()
                });
            }
            if (doc.status === 'rejected') anyRejected = true;
        });
        // Verification rule: minimum 1 accepted document
        const acceptedDocs = user.idDocuments.filter(d => ['accepted','approved'].includes(d.status));
        user.landlordVerified = acceptedDocs.length >= 1;
        await user.save();
        if (!wasVerified && user.landlordVerified) {
            await Notification.create({
                user: user._id,
                type: 'verification',
                title: 'Verification Accepted',
                message: 'Your landlord verification is accepted. You can now list properties.',
                meta: { landlordVerified: true }
            });
        } else if (anyRejected) {
            await Notification.create({
                user: user._id,
                type: 'verification',
                title: 'Document Rejected',
                message: 'One or more of your documents were rejected. Please review and resubmit.',
                meta: { landlordVerified: user.landlordVerified }
            });
        }
        res.status(200).json({
            message: 'Verification updated',
            landlordVerified: user.landlordVerified,
            idDocuments: user.idDocuments
        });
    } catch (error) {
        console.error('Error verifying landlord docs:', error);
        res.status(500).json({ message: 'Error verifying landlord ID documents' });
    }
};

// List notifications for current user
export const getNotifications = async (req, res) => {
    try {
        const notifs = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
        res.json(notifs);
    } catch (e) { res.status(500).json({ message: 'Error fetching notifications' }); }
};

// Mark notification as read
export const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notif = await Notification.findOneAndUpdate({ _id: id, user: req.user._id }, { read: true }, { new: true });
        if (!notif) return res.status(404).json({ message: 'Notification not found' });
        res.json(notif);
    } catch (e) { res.status(500).json({ message: 'Error updating notification' }); }
};

// Multer storage for ID documents (separate from profile pics)
const idStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = 'uploads/ids/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const uploadIds = multer({
    storage: idStorage,
    limits: { fileSize: 1024 * 1024 * 10 }, // Max file size 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only image (JPG, PNG) and PDF files are allowed!"), false);
        }
    }
}).array('idFiles', 10); // up to 10 IDs

export const uploadIdDocument = async (req, res) => {
    uploadIds(req, res, async (err) => {
        if (err) {
            let msg = 'Error uploading files';
            if (err.message && err.message.includes('file too large')) msg = 'File too large. Max size is 10MB.';
            if (err.message && err.message.includes('Only image')) msg = err.message;
            console.error('Upload error:', err.message);
            return res.status(400).json({ message: msg });
        }
        try {
            const { idTypes } = req.body; // Expect JSON string or comma-separated list matching order of files
            let parsedTypes = [];
            if (idTypes) {
                try {
                    parsedTypes = Array.isArray(idTypes) ? idTypes : JSON.parse(idTypes);
                } catch {
                    parsedTypes = idTypes.split(',').map(s => s.trim());
                }
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: 'No files uploaded' });
            }
            const user = await User.findById(req.user._id);
            if (!user) return res.status(404).json({ message: 'User not found' });
            if (user.role !== 'landlord') {
                return res.status(403).json({ message: 'Only landlords can upload verification documents' });
            }

            // Enforce single ID policy BUT allow replacement if existing one is rejected
            if (user.idDocuments.length >= 1) {
                const existing = user.idDocuments[0];
                if (['rejected'].includes(existing.status)) {
                    // Remove old file if present
                    try {
                        if (existing.filename) {
                            const fp = path.join('uploads/ids', existing.filename);
                            if (fs.existsSync(fp)) fs.unlinkSync(fp);
                        }
                    } catch (e) {
                        console.warn('Failed to delete rejected ID file', e.message);
                    }
                    user.idDocuments = []; // clear array for replacement
                } else {
                    return res.status(400).json({ message: 'Only one ID document is allowed. Your current document must be rejected before you can upload a new one.' });
                }
            }
            const firstFile = req.files[0];
            user.idDocuments.push({
                filename: firstFile.filename,
                originalName: firstFile.originalname,
                idType: (parsedTypes[0] || parsedTypes) ? (parsedTypes[0] || 'Unknown') : 'Unknown',
                status: 'pending'
            });

            // After upload landlordVerified must be reset until approval
            user.landlordVerified = false;
            await user.save();
            console.log('Upload ID docs user', String(user._id), 'now has', user.idDocuments.length, 'docs');
            res.status(200).json({
                message: 'ID document uploaded successfully',
                idDocuments: user.idDocuments
            });
        } catch (error) {
            console.error('Error uploading ID documents:', error);
            res.status(500).json({ message: 'Error uploading ID documents' });
        }
    });
};

// ✅ Login User (Includes Role & Token)
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        // Check if user is banned
        if (user.status === 'banned') {
            return res.status(403).json({ 
                message: "Your account has been banned. Please contact support." 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        // Backfill tokenVersion if missing
        if (typeof user.tokenVersion === 'undefined' || user.tokenVersion === null) {
            user.tokenVersion = 0;
        }
        const tokenPayload = { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "1h" });

        // Store the token
        user.tokens.push({ token });
        await user.save();

        res.json({
            token,
            role: user.role
        });

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// ✅ Fetch Tenant Dashboard Data (Includes Profile)
export const getTenantDashboard = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-password");

        if (!user || user.role !== "tenant") {
            return res.status(403).json({ message: "Access denied" });
        }

        res.status(200).json({
            role: user.role,
            profilePic: user.profilePic ? (user.profilePic.startsWith('http') ? user.profilePic : `${req.protocol}://${req.get('host')}/uploads/profiles/${user.profilePic}`) : "",
            fullName: user.fullName || "N/A",
            username: user.username || "N/A",
            address: user.address || "N/A",
            contactNumber: user.contactNumber || "N/A",
            email: user.email || "N/A",
            occupation: user.occupation || "N/A"
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching tenant data" });
    }
};

// ✅ Fetch Landlord Dashboard Data (Includes Profile)
export const getLandlordDashboard = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-password");

        if (!user || user.role !== "landlord") {
            return res.status(403).json({ message: "Access denied" });
        }

        res.status(200).json({
            role: user.role,
            profilePic: user.profilePic ? (user.profilePic.startsWith('http') ? user.profilePic : `${req.protocol}://${req.get('host')}/uploads/profiles/${user.profilePic}`) : "",
            fullName: user.fullName || "N/A",
            username: user.username || "N/A",
            address: user.address || "N/A",
            contactNumber: user.contactNumber || "N/A",
            email: user.email || "N/A",
            occupation: user.occupation || "N/A",
            landlordVerified: user.landlordVerified || false,
            idDocuments: user.idDocuments || []
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching landlord data" });
    }
};

// ✅ Change Password
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (newPassword.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters long" });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Old password is incorrect" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error changing password" });
    }
};

// ✅ Profile Picture Upload (Middleware for handling file uploads)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = 'uploads/profiles/';
        
        // Check if the directory exists, and create it if it doesn't
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true }); // Create the directory if it doesn't exist
        }

        cb(null, uploadPath); // Proceed with the destination
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Generate a unique file name
    }
});

const upload = multer({ storage });

// ✅ Upload Profile Picture
export const uploadProfilePic = upload.single('profilePic'); // legacy disk middleware (kept for compatibility)
export { uploadProfilePicMemory };

// Note: For Cloudinary uploads use `uploadProfilePicMemory` from authMiddleware and check req.file.buffer in `updateProfile`.

// ✅ Update Profile (Including Profile Picture)
export const updateProfile = async (req, res) => {
    try {
        console.log('updateProfile called for user:', req.user?._id, 'filePresent:', !!req.file);
        if (req.file) console.log('updateProfile file:', { originalname: req.file.originalname, size: req.file.size });
        const { fullName, address, barangay, contactNumber, email, occupation, showEmailPublicly } = req.body;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        // Update user details
        user.fullName = fullName || user.fullName;
        user.address = address || user.address;
        user.barangay = barangay || user.barangay;
        user.contactNumber = contactNumber || user.contactNumber;
        user.email = email || user.email;
        user.occupation = occupation || user.occupation;
        if (typeof showEmailPublicly !== 'undefined') {
            user.showEmailPublicly = showEmailPublicly === 'true' || showEmailPublicly === true;
        }

        // If profile picture is uploaded, prefer Cloudinary upload when file buffer exists (memoryUpload)
        if (req.file) {
            // If multer memory storage used, req.file.buffer will exist
            if (req.file.buffer) {
                try {
                    // Defensive dynamic import so we can explain missing module issues
                    const cloudMod = await import('../utils/cloudinary.js').catch(err => {
                        console.error('Failed to import cloudinary util:', err && err.message ? err.message : err);
                        return null;
                    });
                    if (!cloudMod || typeof cloudMod.uploadBuffer !== 'function') {
                        console.error('cloudinary helper uploadBuffer not available');
                        return res.status(500).json({ message: 'Cloudinary upload helper missing on server' });
                    }

                    const result = await cloudMod.uploadBuffer(req.file.buffer, { folder: `tahanap/profiles`});
                    // Delete old remote image if it's a cloudinary public id
                    if (user.profilePic && typeof user.profilePic === 'string' && user.profilePic.startsWith('http')) {
                        try {
                            const pubId = cloudMod.extractPublicId ? cloudMod.extractPublicId(user.profilePic) : null;
                            const cloud = cloudMod.default || cloudMod.cloudinary || null;
                            if (pubId && cloud && cloud.uploader && typeof cloud.uploader.destroy === 'function') {
                                await cloud.uploader.destroy(pubId, { resource_type: 'image' }).catch(e => console.warn('cloudinary destroy failed:', e && e.message));
                            }
                        } catch (e) { console.warn('Failed to delete old Cloudinary image', e && e.message ? e.message : e); }
                    } else if (user.profilePic && typeof user.profilePic === 'string') {
                        // legacy disk file - delete safely
                        const oldPath = path.join(process.cwd(), 'uploads', 'profiles', user.profilePic);
                        try { if (fs.existsSync(oldPath)) await fs.promises.unlink(oldPath); } catch (e) { console.warn('Failed to delete old profile pic file', e && e.message ? e.message : e); }
                    }
                    if (result && result.secure_url) user.profilePic = result.secure_url; // store full secure URL
                    else {
                        console.error('Cloudinary upload did not return secure_url', result);
                        return res.status(500).json({ message: 'Cloudinary upload failed (no secure_url returned)' });
                    }
                } catch (e) {
                    console.error('Cloudinary upload failed for profile pic:', e && e.stack ? e.stack : e);
                    return res.status(500).json({ message: 'Failed to upload profile picture', error: process.env.NODE_ENV !== 'production' ? (e && e.message ? e.message : String(e)) : undefined });
                }
            } else {
                // Disk upload path (legacy)
                try {
                    if (user.profilePic && user.profilePic !== req.file.filename) {
                        const oldPath = path.join(process.cwd(), 'uploads', 'profiles', user.profilePic);
                        if (fs.existsSync(oldPath)) await fs.promises.unlink(oldPath);
                    }
                } catch (e) { console.warn('Failed to delete old legacy profile pic', e && e.message ? e.message : e); }
                user.profilePic = req.file.filename; // Store only the filename for legacy path
            }
        }

        await user.save();

        res.status(200).json({
            message: "Profile updated successfully",
            userData: {
                username: user.username,
                fullName: user.fullName,
                address: user.address,
                barangay: user.barangay,
                contactNumber: user.contactNumber,
                email: user.email,
                occupation: user.occupation,
                profilePic: user.profilePic ? (user.profilePic.startsWith('http') ? user.profilePic : `${req.protocol}://${req.get('host')}/uploads/profiles/${user.profilePic}`) : "",
                showEmailPublicly: user.showEmailPublicly
            }
        });
    } catch (error) {
        console.error('updateProfile error:', error && error.stack ? error.stack : error);
        res.status(500).json({ message: "Error updating profile", error: process.env.NODE_ENV !== 'production' ? (error && error.message ? error.message : String(error)) : undefined });
    }
};

// ✅ Reset (Remove) Profile Picture
export const resetProfilePic = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.profilePic) {
            try {
                if (user.profilePic.startsWith('http')) {
                    // cloudinary hosted - attempt to remove
                    const { extractPublicId, default: cloudinary } = await import('../utils/cloudinary.js');
                    const pubId = extractPublicId(user.profilePic);
                    if (pubId) await cloudinary.uploader.destroy(pubId);
                } else {
                    const filePath = `uploads/profiles/${user.profilePic}`;
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
            } catch (e) {
                console.warn('Failed to delete old profile pic:', e.message);
            }
        }
        user.profilePic = '';
        await user.save();
        res.json({ message: 'Profile picture reset to default', profilePic: '' });
    } catch (e) {
        res.status(500).json({ message: 'Error resetting profile picture' });
    }
};

// Admin: get one landlord verification detail
export const getLandlordVerificationDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('-password');
        if (!user || user.role !== 'landlord') return res.status(404).json({ message: 'Landlord not found' });
        res.json({
            landlordVerified: user.landlordVerified,
            docCount: user.idDocuments.length,
            docs: user.idDocuments
        });
    } catch (e) { res.status(500).json({ message: 'Error fetching landlord verification detail' }); }
};

// Admin: delete a single landlord ID document
export const deleteLandlordIdDocument = async (req, res) => {
    try {
        const { id, docId } = req.params; // id = userId
        const user = await User.findById(id);
        if (!user || user.role !== 'landlord') return res.status(404).json({ message: 'Landlord not found' });
        let doc = user.idDocuments.id(docId);
        if (!doc) {
            // Fallback: sometimes temp objects create string mismatch; try manual filter
            const before = user.idDocuments.length;
            const match = user.idDocuments.find(d => String(d._id) === String(docId));
            if (!match) {
                return res.status(404).json({ message: 'Document not found', docId });
            }
            doc = match;
        }
        const filename = doc.filename;
        // Remove via array filter to be extra safe
        user.idDocuments = user.idDocuments.filter(d => String(d._id) !== String(docId));

        // Attempt to delete physical file (optional)
        if (filename) {
            try {
                const filePath = path.join('uploads/ids', filename);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (fileErr) {
                console.warn('Failed to delete ID file', fileErr.message);
            }
        }

        // Recalculate landlordVerified
    // Recalculate using same rule (>=1 accepted)
    const acceptedDocs = user.idDocuments.filter(d => ['accepted','approved'].includes(d.status));
    user.landlordVerified = acceptedDocs.length >= 1;
        await user.save();
        res.json({ message: 'Document deleted', removed: docId, landlordVerified: user.landlordVerified, remaining: user.idDocuments.length });
    } catch (e) {
        console.error('Error deleting landlord document:', e);
        res.status(500).json({ message: 'Error deleting landlord document' });
    }
};

// Public: get a landlord's public profile (safe fields only)
export const getPublicLandlordProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('fullName username profilePic address contactNumber role landlordVerified email occupation showEmailPublicly');
        if (!user || user.role !== 'landlord') return res.status(404).json({ message: 'Landlord not found' });
        // Build absolute profile pic URL if stored as filename
        let profilePic = user.profilePic || '';
        if (profilePic && !profilePic.startsWith('http')) {
            // Attempt to infer base from request
            profilePic = `${req.protocol}://${req.get('host')}/uploads/profiles/${profilePic}`;
        }
        res.json({
            id: user._id,
            fullName: user.fullName || user.username || 'Landlord',
            username: user.username || '',
            contactNumber: user.contactNumber || '',
            address: user.address || '',
            email: user.showEmailPublicly ? (user.email || '') : '',
            occupation: user.occupation || '',
            verified: !!user.landlordVerified,
            profilePic
        });
    } catch (e) {
        res.status(500).json({ message: 'Error fetching landlord profile' });
    }
};