// travel-tour-app-reviews/middleware/auth.js

// travel-tour-app-reviews/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const path = require('path');

// Try to load User model, but provide fallback if it fails
let User;
try {
  const userModelPath = path.join(__dirname, '..', 'models', 'User.js');
  console.log(`🔍 Loading User model from: ${userModelPath}`);
  User = require(userModelPath);
} catch (error) {
  console.warn('⚠️ User model not found. Using JWT-only authentication.');
  User = null;
}

// Main authentication middleware
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. No token provided.'
            });
        }

        // Verify token with fallback secret
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'app-reviews-fallback-secret-2024');
        
        // If User model is available, try to find user
        if (User) {
            try {
                const user = await User.findById(decoded.id).select('-password');
                
                if (!user) {
                    return res.status(401).json({
                        success: false,
                        message: 'User not found in database'
                    });
                }

                if (!user.isActive) {
                    return res.status(403).json({
                        success: false,
                        message: 'Account is deactivated'
                    });
                }

                // Attach full user object
                req.user = user;
                req.token = token;
                
            } catch (dbError) {
                console.warn('⚠️ Database error in auth, using JWT only:', dbError.message);
                // Fallback to JWT-only authentication
                req.user = {
                    id: decoded.id || decoded.userId,
                    userId: decoded.id || decoded.userId,
                    email: decoded.email || 'unknown@example.com',
                    name: decoded.name || 'User',
                    role: decoded.role || 'student'
                };
                req.token = token;
            }
        } else {
            // JWT-only authentication (no database)
            req.user = {
                id: decoded.id || decoded.userId,
                userId: decoded.id || decoded.userId,
                email: decoded.email || 'unknown@example.com',
                name: decoded.name || 'User',
                role: decoded.role || 'student'
            };
            req.token = token;
        }
        
        console.log(`🔐 Authenticated user: ${req.user.email} (${req.user.role})`);
        next();

    } catch (error) {
        console.error('🔒 Auth error:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Authentication token expired'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Authentication system error'
        });
    }
};

// Admin authorization middleware
const adminAuth = async (req, res, next) => {
    try {
        // First authenticate
        await auth(req, res, () => {
            // Check if user is admin
            if (req.user && req.user.role === 'admin') {
                console.log(`👑 Admin access granted: ${req.user.email}`);
                next();
            } else {
                console.log(`🚫 Admin access denied for: ${req.user?.email || 'unknown'}`);
                res.status(403).json({
                    success: false,
                    message: 'Administrator access required'
                });
            }
        });
    } catch (error) {
        console.error('Admin auth error:', error);
        res.status(500).json({
            success: false,
            message: 'Authorization system error'
        });
    }
};

// Rate limiting middleware
const rateLimit = require('express-rate-limit');

const reviewLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 review submissions per windowMs
    message: {
        success: false,
        message: 'Too many review submissions. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for admin users
        return req.user && req.user.role === 'admin';
    }
});

const shareLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // Limit each IP to 30 shares per hour
    message: {
        success: false,
        message: 'Too many share attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Export middleware
module.exports = { 
    auth, 
    adminAuth, 
    reviewLimiter, 
    shareLimiter 
};