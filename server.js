// travel-tour-app-reviews/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path'); // ADD THIS LINE
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
      "https://travel-tour-academy-backend.onrender.com"
    ],
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://the-conclave-academy.netlify.app",
    "https://travel-tour-academy-backend.onrender.com"
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

// API Routes - FIXED PATH
const appReviewRoutes = require('./src/routes/appReviewRoutes');
app.use('/api', appReviewRoutes);

// Socket.io connection handling - FIXED PATH
require('./src/sockets/notifications')(io);

// Database connection with retry
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected for App Reviews service');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    setTimeout(connectDB, 5000); // Retry after 5 seconds
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

const PORT = process.env.PORT || 5002;

// Start server
server.listen(PORT, async () => {
  console.log(`🚀 App Reviews Service running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  
  // Connect to database
  await connectDB();
  
  console.log('\n🎯 Available Endpoints:');
  console.log(`📍 POST   /api/reviews/submit          - Submit a review`);
  console.log(`📍 GET    /api/reviews/public          - Get public reviews`);
  console.log(`📍 GET    /api/reviews/pending         - Get pending reviews (Admin)`);
  console.log(`📍 PUT    /api/reviews/:id/status      - Update review status (Admin)`);
  console.log(`📍 POST   /api/reviews/:id/helpful     - Mark review as helpful`);
  console.log(`📍 POST   /api/analytics/share         - Track share analytics`);
  console.log(`📍 GET    /api/analytics/shares        - Get share analytics (Admin)`);
  console.log(`📍 GET    /api/stats                   - Get review statistics`);
  console.log(`📍 WS     /socket.io                  - Real-time notifications`);
});