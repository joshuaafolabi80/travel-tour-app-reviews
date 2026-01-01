// travel-tour-app-reviews/middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Main authentication middleware
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // Attach user to request
        req.user = user;
        req.token = token;
        next();

    } catch (error) {
        console.error('Auth error:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

// Admin authorization middleware
const adminAuth = async (req, res, next) => {
    try {
        // First authenticate
        await auth(req, res, () => {
            // Check if user is admin
            if (req.user.role === 'admin') {
                next();
            } else {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Authorization error'
        });
    }
};

// Rate limiting middleware
const rateLimit = require('express-rate-limit');

const reviewLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 review submissions per windowMs
    message: {
        success: false,
        message: 'Too many review submissions. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const shareLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Limit each IP to 20 shares per hour
    message: {
        success: false,
        message: 'Too many share attempts. Please try again later.'
    }
});

module.exports = { auth, adminAuth, reviewLimiter, shareLimiter };
