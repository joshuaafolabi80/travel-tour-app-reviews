const jwt = require('jsonwebtoken');
const path = require('path');

// Try to load User model, but provide fallback if it fails
let User;
try {
  // Adjusted path to look for models in the correct directory structure
  const userModelPath = path.join(__dirname, '..', 'models', 'User.js');
  User = require(userModelPath);
} catch (error) {
  console.warn('⚠️ User model not found. Using JWT-only authentication.');
  User = null;
}

/**
 * Main authentication middleware
 * Verifies the JWT token and attaches the user to the request object
 */
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

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'app-reviews-fallback-secret-2024');
        
        // If User model is available, try to find user in DB to check status
        if (User) {
            try {
                const user = await User.findById(decoded.id || decoded.userId).select('-password');
                
                if (!user) {
                    return res.status(401).json({
                        success: false,
                        message: 'User not found in database'
                    });
                }

                // FIX: Only block if isActive is EXPLICITLY set to false.
                // This prevents new/existing accounts without this field from being locked out.
                if (user.isActive === false) {
                    return res.status(403).json({
                        success: false,
                        message: 'Account is deactivated'
                    });
                }

                // Attach full user object from DB
                req.user = user;
                req.token = token;
                
            } catch (dbError) {
                console.warn('⚠️ Database error in auth, falling back to token data:', dbError.message);
                // Fallback: use data encoded in the JWT if DB is unreachable
                req.user = {
                    _id: decoded.id || decoded.userId,
                    id: decoded.id || decoded.userId,
                    email: decoded.email,
                    role: decoded.role || 'user'
                };
                req.token = token;
            }
        } else {
            // JWT-only authentication (No User model found)
            req.user = {
                _id: decoded.id || decoded.userId,
                id: decoded.id || decoded.userId,
                email: decoded.email,
                role: decoded.role || 'user'
            };
            req.token = token;
        }
        
        console.log(`🔐 Authenticated: ${req.user.email} | Role: ${req.user.role}`);
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

/**
 * Admin authorization middleware
 * Ensures the authenticated user has the 'admin' role
 */
const adminAuth = async (req, res, next) => {
    // Call the auth middleware first
    auth(req, res, () => {
        if (req.user && req.user.role === 'admin') {
            console.log(`👑 Admin access granted: ${req.user.email}`);
            next();
        } else {
            console.log(`🚫 Admin access denied: ${req.user?.email || 'unknown'}`);
            res.status(403).json({
                success: false,
                message: 'Administrator access required'
            });
        }
    });
};

// Rate limiting middleware
const rateLimit = require('express-rate-limit');

const reviewLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
        success: false,
        message: 'Too many review submissions. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.user && req.user.role === 'admin'
});

const shareLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30,
    message: {
        success: false,
        message: 'Too many share attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = { 
    auth, 
    adminAuth, 
    reviewLimiter, 
    shareLimiter 
};