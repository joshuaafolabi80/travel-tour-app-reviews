// travel-tour-app-reviews/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://the-conclave-academy.netlify.app",
      "https://travel-tour-academy-backend.onrender.com",
      "https://travel-tour-app-reviews.onrender.com"
    ],
    credentials: true
  }
});

// Store io instance in app for access in routes
app.set('io', io);

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://the-conclave-academy.netlify.app",
    "https://travel-tour-academy-backend.onrender.com",
    "https://travel-tour-app-reviews.onrender.com"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`📱 ${req.method} ${req.path}`, {
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    body: req.body && Object.keys(req.body).length > 0 ? '***' : undefined,
    authorization: req.headers.authorization ? 'Bearer ***' : 'None'
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'App Reviews & Ratings Service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// API Routes - Corrected path (Removed 'src')
try {
  const appReviewRoutes = require(path.join(__dirname, 'routes', 'appReviewRoutes'));
  app.use('/api', appReviewRoutes);
  console.log('✅ Routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load routes:', error);
  app.use('/api', (req, res) => {
    res.status(500).json({
      success: false,
      message: 'Routes failed to load. Check server logs.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  });
}

// Socket.io connection handling - Corrected path (Removed 'src')
try {
  require(path.join(__dirname, 'sockets', 'notifications'))(io);
  console.log('✅ Socket.io initialized');
} catch (error) {
  console.error('❌ Failed to load sockets:', error);
}

// Database connection with retry
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/app-reviews', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10
    });
    console.log('✅ MongoDB connected for App Reviews service');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️ Running without database connection');
    } else {
      setTimeout(connectDB, 5000);
    }
  }
};

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 App Reviews Service Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    service: 'App Reviews & Ratings Service'
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, async () => {
  console.log(`🚀 App Reviews Service running on port ${PORT}`);
  await connectDB();
});