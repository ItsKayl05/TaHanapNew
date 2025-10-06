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

// Environment-based CORS configuration
const getCorsOptions = () => {
    const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5174', 
        'http://localhost:5176',
        'https://tahanap-frontend.onrender.com',
        'https://tahanap-backend.onrender.com',
        'https://tahanap-admin.onrender.com'
    ];

    // Add any additional origins from environment variable
    if (process.env.ALLOWED_ORIGINS) {
        allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
    }

    return {
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl, etc.)
            if (!origin) return callback(null, true);
            
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            } else {
                // In development, be more permissive
                if (process.env.NODE_ENV !== 'production') {
                    console.log('Allowing origin in development:', origin);
                    return callback(null, true);
                }
                console.log('CORS blocked origin:', origin);
                return callback(new Error('Not allowed by CORS'), false);
            }
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true,
        maxAge: 86400
    };
};

const corsOptions = getCorsOptions();

// Configure Socket.IO with proper CORS
const io = new SocketIOServer(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            
            const allowedOrigins = [
                'http://localhost:5173',
                'http://localhost:5174',
                'http://localhost:5176',
                'https://tahanap-frontend.onrender.com',
                'https://tahanap-backend.onrender.com',
                'https://tahanap-admin.onrender.com'
            ];

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            } else {
                if (process.env.NODE_ENV !== 'production') {
                    console.log('Socket.IO allowing origin in development:', origin);
                    return callback(null, true);
                }
                return callback(new Error('Not allowed by CORS'), false);
            }
        },
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    },
    transports: ['polling', 'websocket'] // Enable both transports
});

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', ({ roomId }) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
    });

    socket.on('sendMessage', (data) => {
        // data: { roomId, message, senderId, receiverId, timestamp }
        console.log('Message received for room:', data.roomId);
        io.to(data.roomId).emit('receiveMessage', data);
    });

    socket.on('disconnect', (reason) => {
        console.log('User disconnected:', socket.id, 'Reason:', reason);
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Add CORS headers manually as additional fallback
app.use((req, res, next) => {
    const allowedOrigins = [
        'https://tahanap-frontend.onrender.com',
        'https://tahanap-backend.onrender.com',
        'https://tahanap-admin.onrender.com',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5176'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

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
    res.json({ 
        message: 'Server is running. MongoDB connected!',
        timestamp: new Date().toISOString()
    });
});

// Socket.IO health check
app.get('/socket-health', (req, res) => {
    res.json({
        connectedClients: io.engine.clientsCount,
        serverTime: new Date().toISOString()
    });
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
                profilePicUrl: `${req.protocol}://${req.get('host')}/uploads/profiles/${updatedUser.profilePic}`,
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
    
    // Handle CORS errors
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ 
            message: 'CORS Error: Origin not allowed',
            allowedOrigins: [
                'https://tahanap-frontend.onrender.com',
                'https://tahanap-backend.onrender.com',
                'https://tahanap-admin.onrender.com',
                'http://localhost:5173',
                'http://localhost:5174',
                'http://localhost:5176'
            ]
        });
    }
    
    // Handle multer errors (file upload)
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ 
            message: 'File too large. Maximum size is 5MB.' 
        });
    }
    
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        message: 'Route not found',
        path: req.originalUrl
    });
});

// Start server (with Socket.IO)
server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📡 Socket.IO server initialized`);
    console.log(`🌐 CORS enabled for: ${[
        'https://tahanap-frontend.onrender.com',
        'https://tahanap-backend.onrender.com',
        'https://tahanap-admin.onrender.com',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5176'
    ].join(', ')}`);
});