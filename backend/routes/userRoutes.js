import express from "express";
import { protect, roleCheck } from "../middleware/authMiddleware.js";
import {
    logout,
    logoutAll,
    getUsers,
    banUser,
    unbanUser,
    deleteUser,
    getTenantDashboard,
    getLandlordDashboard,
    changePassword,
    updateProfile,
    uploadProfilePic,
    uploadIdDocument,
    getLandlordsForVerification,
    verifyLandlordID,
    getNotifications,
    markNotificationRead,
    resetProfilePic,
    getLandlordVerificationDetail,
    deleteLandlordIdDocument,
    getPublicLandlordProfile,
} from "../controllers/userController.js";

const router = express.Router();

// Admin routes
router.get("/", protect, roleCheck("admin"), getUsers);

// Get current user's data
router.get("/me", protect, async (req, res) => {
    try {
        const user = await (await import('../models/User.js')).default.findById(req.user.id).select('-password -tokens');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching user data', error: err.message });
    }
});

// All users (for messaging, accessible to tenant/landlord)
router.get("/all", protect, (req, res, next) => {
    // Only allow tenant or landlord
    if (req.user.role === 'tenant' || req.user.role === 'landlord') return next();
    return res.status(403).json({ message: 'Forbidden' });
}, async (req, res) => {
    try {
        const users = await (await import('../models/User.js')).default.find({}, '-password -tokens').lean();
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching users', error: err.message });
    }
});
router.put("/:id/ban", protect, roleCheck("admin"), banUser);
router.put("/:id/unban", protect, roleCheck("admin"), unbanUser);
router.delete("/:id", protect, roleCheck("admin"), deleteUser);

// Tenant routes
router.get("/tenant-dashboard", protect, roleCheck("tenant"), getTenantDashboard);

// Landlord routes
router.get("/landlord-dashboard", protect, roleCheck("landlord"), getLandlordDashboard);

// Common routes
router.post("/change-password", protect, changePassword);
router.put("/update-profile", protect, uploadProfilePic, updateProfile);
router.put('/reset-profile-pic', protect, resetProfilePic);
// Multi-ID upload (handled internally with its own multer config)
router.post("/upload-id", protect, uploadIdDocument);

// Admin verification routes
router.get("/landlords-for-verification", protect, roleCheck("admin"), getLandlordsForVerification);
router.get('/landlord-verification/:id', protect, roleCheck('admin'), getLandlordVerificationDetail);
router.delete('/landlord-verification/:id/doc/:docId', protect, roleCheck('admin'), deleteLandlordIdDocument);
router.post("/verify-landlord-id", protect, roleCheck("admin"), verifyLandlordID);

// Logout routes
router.post('/logout', protect, logout);
router.post('/logout-all', protect, logoutAll);

// Notifications
router.get('/notifications', protect, getNotifications);
router.put('/notifications/:id/read', protect, markNotificationRead);

// Public landlord profile (read-only)
router.get('/landlord/:id/profile', getPublicLandlordProfile);

export default router;