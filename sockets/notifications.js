// travel-tour-app-reviews/sockets/notifications.js

const socketAuth = require('../middleware/socketAuth');

module.exports = (io) => {
    // Authentication middleware for socket connections
    io.use(socketAuth);

    io.on('connection', (socket) => {
        console.log(`🔌 New socket connection: ${socket.userId} (${socket.userRole})`);

        // Join admin room if user is admin
        if (socket.userRole === 'admin') {
            socket.join('admin');
            console.log(`👑 Admin ${socket.userId} joined admin room`);
        }

        // Join user's personal room for private notifications
        socket.join(`user_${socket.userId}`);

        // Handle review submission notifications
        socket.on('submitReview', async (reviewData) => {
            try {
                // Notify admins about new review
                io.to('admin').emit('newReviewNotification', {
                    type: 'new_review',
                    userId: socket.userId,
                    userName: socket.user.name,
                    reviewData,
                    timestamp: new Date()
                });

                // Send confirmation to user
                socket.emit('reviewSubmitted', {
                    success: true,
                    message: 'Review submitted for moderation'
                });
            } catch (error) {
                console.error('Socket review submission error:', error);
                socket.emit('error', { message: 'Failed to submit review' });
            }
        });

        // Handle admin actions
        socket.on('approveReview', (data) => {
            const { reviewId, userId } = data;
            
            // Notify the specific user
            io.to(`user_${userId}`).emit('reviewApproved', {
                reviewId,
                message: 'Your review has been approved and is now visible to the public',
                timestamp: new Date()
            });
        });

        socket.on('rejectReview', (data) => {
            const { reviewId, userId, reason } = data;
            
            // Notify the specific user
            io.to(`user_${userId}`).emit('reviewRejected', {
                reviewId,
                reason: reason || 'Your review did not meet our guidelines',
                timestamp: new Date()
            });
        });

        // Handle typing indicators for admin responses
        socket.on('typingResponse', (data) => {
            const { reviewId, isTyping } = data;
            
            if (socket.userRole === 'admin') {
                // Broadcast to admins who's typing
                socket.to('admin').emit('adminTyping', {
                    adminId: socket.userId,
                    adminName: socket.user.name,
                    reviewId,
                    isTyping,
                    timestamp: new Date()
                });
            }
        });

        // Handle online status
        socket.on('userOnline', () => {
            if (socket.userRole === 'admin') {
                io.emit('adminOnline', {
                    adminId: socket.userId,
                    adminName: socket.user.name,
                    timestamp: new Date()
                });
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`🔌 Socket disconnected: ${socket.userId}`);
            
            if (socket.userRole === 'admin') {
                io.emit('adminOffline', {
                    adminId: socket.userId,
                    timestamp: new Date()
                });
            }
        });

        // Error handling
        socket.on('error', (error) => {
            console.error('Socket error:', error);
            socket.emit('error', { message: 'Socket error occurred' });
        });
    });

    // Make io instance available to routes
    return io;
};