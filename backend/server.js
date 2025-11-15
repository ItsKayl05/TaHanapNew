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
import paymentRoutes from './routes/paymentRoutes.js';
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

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Connect to MongoDB first
connectDB();

// Enhanced CORS configuration - FIXED for admin domain
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, or server-side requests)
    if (!origin) {
      console.log('ℹ️  No origin header - allowing request');
      return callback(null, true);
    }
    
    // Development origins
    const devOrigins = [
      'http://localhost:5173',
      'http://localhost:5174', 
      'http://localhost:5176',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5176',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:4000'
    ];
    
    // Production origins - UPDATED with exact admin domains
    const prodOrigins = [
      'https://tahanap-frontend-joyb.onrender.com',
      'https://tahanap-backend-g6mx.onrender.com',
      'https://tahanap-backend.onrender.com',
      'https://tahanap-admin-o398.onrender.com', // EXACT admin domain from error
      'https://tahanap-admin-o938.onrender.com',
      'https://tahanap.xyz',
      'https://www.tahanap.xyz',
      'https://api.tahanap.xyz',
      'https://admin.tahanap.xyz'
    ];

    // Combine all allowed origins
    const allowedOrigins = [...devOrigins, ...prodOrigins];
    
    // Add environment variable origins if any
    if (process.env.ALLOWED_ORIGINS) {
      const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
      allowedOrigins.push(...envOrigins);
      console.log('🔧 Added environment origins:', envOrigins);
    }

    // Check if origin is allowed
    const isAllowedOrigin = allowedOrigins.includes(origin);
    
    // Allow any Render-hosted subdomain for flexibility
    const isRenderHost = typeof origin === 'string' && origin.endsWith('.onrender.com');
    
    // In development, allow all origins for testing
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (isAllowedOrigin || isRenderHost || isDevelopment) {
      console.log(`✅ Allowed CORS origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`🚫 Blocked CORS origin: ${origin}`);
      console.log(`📋 Allowed origins:`, allowedOrigins);
      callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'x-socket-id',
    'x-debug-token',
    'Accept'
  ],
  exposedHeaders: [
    'Authorization',
    'x-total-count',
    'x-total-pages'
  ],
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware globally
app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

// Additional CORS headers middleware - ENHANCED
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-socket-id, x-debug-token');
  res.header('Access-Control-Expose-Headers', 'Authorization, x-total-count, x-total-pages');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🛬 Preflight request handled for:', req.headers.origin);
    return res.status(200).end();
  }
  
  next();
});

// Body parsing middleware - increased limits for large uploads
const jsonParser = express.json({ limit: '200mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '200mb' });
const bpJson = bodyParser.json({ limit: '200mb' });

// Skip body parsers for multipart requests (handled by multer)
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return next();
  }
  return jsonParser(req, res, next);
});

app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return next();
  }
  return urlencodedParser(req, res, next);
});

app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) return next();
  return bpJson(req, res, next);
});

// Create HTTP server
import http from 'http';
const server = http.createServer(app);

// Increase server timeouts for uploads
server.setTimeout(10 * 60 * 1000); // 10 minutes

// Configure Socket.IO with enhanced CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5176',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5176',
      'https://tahanap-frontend-joyb.onrender.com',
      'https://tahanap.xyz',
      'https://www.tahanap.xyz',
      'https://tahanap-admin-o398.onrender.com', // ADDED admin domain
      'https://tahanap-admin-o938.onrender.com'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-socket-id']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  console.log('📡 Total connections:', io.engine.clientsCount);

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
      const { roomId, senderId, receiverId, message, propertyId } = data;
      
      // Validate required fields
      if (!roomId || !senderId || !receiverId || !message) {
        console.error('Missing required message fields');
        return;
      }

      // Save message to database
      const newMessage = new Message({
        sender: senderId,
        receiver: receiverId,
        content: message,
        property: propertyId || null
      });

      await newMessage.save();

      // Populate the message for frontend
      const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender', 'fullName profilePic')
        .populate('property', 'title price images');

      // Emit to room
      io.to(roomId).emit('receiveMessage', populatedMessage);
      
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('messageError', { error: 'Failed to send message' });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ User disconnected:', socket.id, 'Reason:', reason);
  });
});

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
app.use('/api/payments', paymentRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/applications", applicationRoutes);

// Enhanced health check endpoints with CORS info
app.get('/', (req, res) => {
  res.json({
    message: 'Tahanap API Server is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cors: {
      enabled: true,
      origin: req.headers.origin || 'none'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    server: 'Running',
    database: 'Connected',
    cors: 'Enabled',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin || 'none'
  });
});

app.get('/socket-health', (req, res) => {
  res.json({
    connectedClients: io.engine.clientsCount,
    serverTime: new Date().toISOString()
  });
});

// Enhanced CORS test endpoint
app.get('/api/test-cors', (req, res) => {
  res.json({
    message: 'CORS is working correctly!',
    origin: req.headers.origin,
    method: req.method,
    timestamp: new Date().toISOString(),
    cors: {
      allowed: true,
      credentials: true
    }
  });
});

// Specific admin CORS test endpoint
app.get('/api/admin/test-cors', (req, res) => {
  console.log('🔧 Admin CORS test request from:', req.headers.origin);
  res.json({
    message: 'Admin CORS test successful!',
    origin: req.headers.origin,
    admin: true,
    timestamp: new Date().toISOString()
  });
});

// Enhanced profile update route
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

app.put('/api/users/update-profile', protect, upload.single('profilePic'), async (req, res) => {
  try {
    const { fullName, address, contactNumber } = req.body;
    const profilePic = req.file ? req.file.filename : req.user.profilePic;

    const user = await User.findById(req.user.id);
    if (user.status === 'banned') {
      return res.status(403).json({
        message: "Account banned. Profile cannot be updated.",
        banned: true
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { fullName, address, contactNumber, profilePic },
      { new: true, runValidators: true }
    ).select('-password -tokens');

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', err.stack);

  // CORS specific errors
  if (err.message === 'Not allowed by CORS' || err.message.includes('CORS')) {
    return res.status(403).json({
      message: 'CORS Error: Origin not allowed',
      origin: req.headers.origin,
      allowedOrigins: [
        'https://tahanap-admin-o398.onrender.com',
        'https://tahanap-admin-o938.onrender.com',
        'https://tahanap-frontend-joyb.onrender.com',
        'https://tahanap.xyz',
        'http://localhost:5173'
      ],
      timestamp: new Date().toISOString()
    });
  }

  // Multer file size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: 'File too large',
      maxSize: '5MB'
    });
  }

  // General server errors
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Tahanap API Server running on port ${port}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Server URL: http://localhost:${port}`);
  console.log(`📡 Socket.IO ready for connections`);
  console.log(`✅ CORS enabled for:`);
  console.log(`   - https://tahanap-admin-o398.onrender.com (Admin)`);
  console.log(`   - https://tahanap-frontend-joyb.onrender.com (Frontend)`);
  console.log(`   - https://tahanap.xyz (Production)`);
  console.log(`   - http://localhost:5173 (Development)`);
});

// Make io available via the express app
app.set('io', io);

export default app;