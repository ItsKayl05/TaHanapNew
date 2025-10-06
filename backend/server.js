import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import bodyParser from 'body-parser';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import propertyRoutes from './routes/propertyRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
 
import adminRoutes from "./routes/adminRoutes.js";
import favoriteRoutes from './routes/favoriteRoutes.js';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { protect } from './middleware/authMiddleware.js';
import User from './models/User.js';

// Initialize Express
const app = express();
const port = process.env.PORT || 4000;

// Create HTTP server and Socket.IO instance
import http from 'http';
const server = http.createServer(app);
// In development accept any localhost origin (any port) to avoid dev-port mismatches.
const io = new SocketIOServer(server, {
    cors: {
        origin: (origin, callback) => {
            // allow requests with no origin (mobile apps, curl)
            if (!origin) return callback(null, true);
            try {
                const url = new URL(origin);
                // Accept localhost and 127.0.0.1 on any port during development
                if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return callback(null, true);
            } catch (e) {
                // If URL parsing fails, fall back to strict match below
            }
            // Fallback to specific allowed list if needed
            const allowed = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5176'];
            if (allowed.includes(origin)) return callback(null, true);
            const msg = 'Origin not allowed by CORS';
            return callback(new Error(msg), false);
        },
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true
    }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', ({ roomId }) => {
        socket.join(roomId);
    });

    socket.on('sendMessage', (data) => {
        // data: { roomId, message, senderId, receiverId, timestamp }
        io.to(data.roomId).emit('receiveMessage', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure CORS properly - allow any localhost origin during development to avoid dev-port mismatches
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        try {
            const url = new URL(origin);
            if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return callback(null, true);
        } catch (e) {
            // ignore parse errors
        }
        const allowed = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5176'];
        if (allowed.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
};

// Configure Multer for Profile Picture Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/profiles/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors(corsOptions)); // Use the configured CORS options
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes
app.use(express.json());
app.use(bodyParser.json());

// Serve static files for profile pictures and properties
app.use('/uploads/profiles', express.static(path.join(__dirname, 'uploads/profiles')));
app.use('/uploads/properties', express.static(path.join(__dirname, 'uploads/properties')));
// Serve landlord ID documents
app.use('/uploads/ids', express.static(path.join(__dirname, 'uploads/ids')));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/applications", applicationRoutes);
 

// Health check route
app.get('/', (req, res) => {
    res.send('Server is running. MongoDB connected!');
});

// Enhanced profile update route with authentication and error handling
app.put('/api/users/update-profile', protect, upload.single('profilePic'), async (req, res) => {
    try {
        const { fullName, address, contactNumber } = req.body;
        const profilePic = req.file ? req.file.filename : req.user.profilePic;

        // Check if user is banned (additional protection)
        const user = await User.findById(req.user.id);
        if (user.status === 'banned') {
            return res.status(403).json({ 
                message: "🚨 Account banned. Profile cannot be updated.",
                banned: true
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id, 
            { fullName, address, contactNumber, profilePic },
            { new: true, runValidators: true }
        ).select('-password -tokens');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'Profile updated successfully',
            user: {
                ...updatedUser.toObject(),
                profilePicUrl: `http://localhost:${port}/uploads/profiles/${updatedUser.profilePic}`,
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ 
            message: 'Error updating profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Add user status check endpoint
app.get('/api/users/check-status', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('status');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ status: user.status });
    } catch (error) {
        res.status(500).json({ message: 'Error checking user status' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something broke!', error: err.message });
});

// Start server (with Socket.IO)
server.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});