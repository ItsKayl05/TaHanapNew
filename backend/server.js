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
import Message from './models/Message.js';

// Initialize Express
const app = express();
const port = process.env.PORT || 4000;
const backendBase = process.env.BACKEND_URL || process.env.APP_URL || `http://localhost:${port}`;

// Helper: normalize origin strings
const normalizeOrigin = (origin) => {
    if (!origin) return origin;
    try {
        return origin.trim().replace(/\/+$/, '').toLowerCase();
    } catch (e) {
        return origin;
    }
};

// Build canonical allowed origins
const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5176',
    'https://tahanap-frontend-joyb.onrender.com',
    'https://tahanap-backend-g6mx.onrender.com',
    'https://tahanap-backend.onrender.com',
    'https://tahanap-admin-o398.onrender.com',
    'https://tahanap.xyz',
    'https://www.tahanap.xyz',
    'https://api.tahanap.xyz',
    'https://admin.tahanap.xyz'
];

const ALLOWED_ORIGINS = (() => {
    const list = [...DEFAULT_ALLOWED_ORIGINS];
    if (process.env.ALLOWED_ORIGINS) {
        list.push(...process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean));
    }
    return Array.from(new Set(list.map(normalizeOrigin)));
})();

const ALLOW_ALL = process.env.ALLOW_ALL_ORIGINS === 'true';

const isOriginAllowed = (origin) => {
    if (!origin) return true;
    if (ALLOW_ALL) return true;
    const norm = normalizeOrigin(origin);
    return ALLOWED_ORIGINS.includes(norm);
};

// Create HTTP server
import http from 'http';
const server = http.createServer(app);

// CORS Configuration - FIXED: More permissive for Socket.IO
const corsOptions = {
    origin: (origin, callback) => {
        if (ALLOW_ALL) {
            return callback(null, true);
        }
        if (!origin) return callback(null, true);
        if (isOriginAllowed(origin)) {
            return callback(null, true);
        }
        if (process.env.NODE_ENV !== 'production') {
            console.log('Allowing origin in development:', origin);
            return callback(null, true);
        }
        console.warn('CORS blocked origin:', origin);
        return callback(new Error('Not allowed by CORS'), false);
    },
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-socket-id'],
    credentials: true,
    maxAge: 86400
};

// IMPORTANT: Apply CORS middleware BEFORE Socket.IO
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Additional CORS headers for Socket.IO polling
app.use('/socket.io', (req, res, next) => {
    const origin = req.headers.origin;
    if (isOriginAllowed(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-socket-id');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Configure Socket.IO with proper CORS - FIXED: More permissive settings
const io = new SocketIOServer(server, {
    cors: {
        origin: function (origin, callback) {
            // Allow all origins in development, check in production
            if (process.env.NODE_ENV !== 'production' || ALLOW_ALL) {
                return callback(null, true);
            }
            if (!origin || isOriginAllowed(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'), false);
        },
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true
    },
    transports: ['websocket', 'polling'], // FIXED: Ensure both transports
    path: '/socket.io/', // FIXED: Explicit path
    allowEIO3: true,
    connectTimeout: 45000, // FIXED: Increased timeout
    pingTimeout: 20000,
    pingInterval: 25000
});

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    socket.on('joinRoom', ({ roomId }) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
    });

    socket.on('leaveRoom', ({ roomId }) => {
        socket.leave(roomId);
        console.log(`User ${socket.id} left room: ${roomId}`);
    });

    socket.on('sendMessage', async (data) => {
        try {
            const roomId = data.roomId;
            const senderId = data.senderId || data.sender;
            const receiverId = data.receiverId || data.receiver;
            const content = data.message || data.content || '';
            const propertyId = data.propertyId || data.property;

            // Save to MongoDB
            const msgDoc = new Message({
                sender: senderId,
                receiver: receiverId,
                content: content,
                property: propertyId || undefined
            });
            await msgDoc.save();

            // Populate property for frontend
            const populated = await Message.findById(msgDoc._id).populate({ 
                path: 'property', 
                select: '_id title price images' 
            });
            
            let payload = populated && populated.toObject ? populated.toObject() : populated;
            if (payload && payload.property && payload.property.images) {
                payload.property.images = (payload.property.images || []).map(img => {
                    if (!img) return img;
                    if (String(img).startsWith('http')) return img;
                    const rel = String(img).startsWith('/') ? String(img) : `/${String(img)}`;
                    return `${backendBase}${rel}`;
                });
            }

            // Emit the message to the room
            io.to(roomId).emit('receiveMessage', payload);
        } catch (err) {
            console.error('Socket save message error:', err);
            const roomId = data.roomId;
            io.to(roomId).emit('receiveMessage', { ...data, _error: 'failed_to_save' });
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('❌ User disconnected:', socket.id, 'Reason:', reason);
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
    limits: { fileSize: 1024 * 1024 * 5 },
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

// Additional CORS middleware as fallback
app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (isOriginAllowed(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-socket-id');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

app.use(express.json());
app.use(bodyParser.json());

// Serve static files
app.use('/uploads/profiles', express.static(path.join(__dirname, 'uploads/profiles')));
app.use('/uploads/properties', express.static(path.join(__dirname, 'uploads/properties')));
app.use('/uploads/ids', express.static(path.join(__dirname, 'uploads/ids')));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/applications", applicationRoutes);

// Simple geocoding proxy
app.get('/api/geocode', async (req, res) => {
    const q = req.query.q;
    if (!q || String(q).trim() === '') return res.status(400).json({ message: 'Missing query parameter q' });

    const target = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;

    try {
        let fetchFn = globalThis.fetch;
        if (!fetchFn) {
            try {
                const mod = await import('node-fetch');
                fetchFn = mod.default || mod;
            } catch (err) {
                console.error('Fetch is not available and node-fetch could not be loaded:', err);
                return res.status(500).json({ message: 'Server missing fetch capability' });
            }
        }

        const response = await fetchFn(target, {
            headers: {
                'User-Agent': process.env.NOMINATIM_USER_AGENT || 'TaHanap/1.0 (+https://tahanap.xyz)',
                'Accept-Language': 'en'
            },
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            console.error('Nominatim responded with non-OK status', response.status, text);
            return res.status(502).json({ message: 'Failed to fetch geocoding data', status: response.status });
        }

        const data = await response.json().catch(() => null);

        res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
        return res.json(data);
    } catch (error) {
        console.error('Geocode proxy error:', error);
        return res.status(502).json({ message: 'Error proxying geocode request' });
    }
});

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

// Enhanced profile update route
app.put('/api/users/update-profile', protect, upload.single('profilePic'), async (req, res) => {
    try {
        const { fullName, address, contactNumber } = req.body;
        const profilePic = req.file ? req.file.filename : req.user.profilePic;

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
            allowedOrigins: ALLOWED_ORIGINS
        });
    }

    // Handle multer errors
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

// Start server
server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📡 Socket.IO server initialized`);
    console.log(`🌐 CORS enabled for origins:`, ALLOWED_ORIGINS);
    console.log(`🔧 Socket.IO path: /socket.io/`);
    console.log(`🔄 Transports: websocket, polling`);
});

// Make io available via the express app
app.set('io', io);