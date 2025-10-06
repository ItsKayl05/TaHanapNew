import jwt from "jsonwebtoken";
import User from "../models/User.js";
import multer from "multer";

// Protect routes by verifying JWT
export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
        return res.status(401).json({ message: "🚨 Not authorized, no token" });
    }

    try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return res.status(401).json({ message: "🚨 User not found" });
        }

        // Enhanced banned user check with token versioning
        if (user.status === 'banned') {
            // Clear all tokens and increment token version
            user.tokens = [];
            user.tokenVersion = (user.tokenVersion || 0) + 1;
            await user.save();
            
            return res.status(403).json({ 
                success: false,
                message: "🚨 Account banned. Please contact support.",
                banned: true
            });
        }

        // Normalize undefined tokenVersion to 0 for legacy users
        if (typeof user.tokenVersion === 'undefined') {
            user.tokenVersion = 0;
            await user.save();
        }
        const userTokenVersion = user.tokenVersion || 0;
        const tokenVersionFromToken = (decoded.tokenVersion === undefined || decoded.tokenVersion === null) ? 0 : decoded.tokenVersion;
        if (userTokenVersion !== tokenVersionFromToken) {
            return res.status(401).json({ message: "🚨 Token invalidated. Please log in again.", code: 'TOKEN_VERSION_MISMATCH' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: '🚨 Token expired. Please log in again.', code: 'TOKEN_EXPIRED' });
        }
        res.status(401).json({ message: "🚨 Token is invalid", code: 'TOKEN_INVALID' });
    }
};

// Middleware to check if user has required role
export const roleCheck = (role) => (req, res, next) => {
    if (!req.user || req.user.role !== role) {
        return res.status(403).json({ message: "🚨 Access denied" });
    }
    next();
};

// Profile Picture Upload Middleware (using multer)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/profiles/"); // Save uploaded files to the 'uploads/profiles' directory
    },
    filename: (req, file, cb) => {
        cb(null, `${req.user.id}-${Date.now()}-${file.originalname}`); // Create unique filename
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // Max file size 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed!"), false);
        }
    }
});

// Export the upload middleware for use in routes
export const uploadProfilePic = upload.single("profilePic");