// travel-tour-app-reviews/middleware/socketAuth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const socketAuth = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return next(new Error('Authentication error: User not found'));
        }

        if (!user.isActive) {
            return next(new Error('Authentication error: Account deactivated'));
        }

        // Attach user to socket
        socket.user = user;
        socket.userId = user._id;
        socket.userRole = user.role;
        
        next();
    } catch (error) {
        console.error('Socket auth error:', error.message);
        next(new Error('Authentication error: Invalid token'));
    }
};

module.exports = socketAuth;