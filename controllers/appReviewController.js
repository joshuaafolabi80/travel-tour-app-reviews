// travel-tour-app-reviews/controllers/appReviewController.js

const AppReview = require('../models/AppReview');
const ShareAnalytics = require('../models/ShareAnalytics');
const User = require('../models/User');

// Submit a review
exports.submitReview = async (req, res) => {
    try {
        const { rating, review, appStore, deviceInfo } = req.body;
        
        // Validation
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid rating (1-5)'
            });
        }

        // Check if user already has a pending review
        const existingReview = await AppReview.findOne({
            userId: req.user._id,
            status: 'pending'
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending review. Please wait for approval.'
            });
        }

        // Check for similar recent reviews to prevent spam
        const recentReviews = await AppReview.find({
            userId: req.user._id,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        });

        if (recentReviews.length >= 3) {
            return res.status(429).json({
                success: false,
                message: 'Too many review submissions. Please try again tomorrow.'
            });
        }

        // Create new review
        const newReview = new AppReview({
            userId: req.user._id,
            userName: req.user.name || req.user.email.split('@')[0],
            userEmail: req.user.email,
            rating,
            review: review || '',
            appStore: appStore || 'web',
            deviceInfo: deviceInfo || {},
            metadata: {
                ipAddress: req.ip,
                sessionId: req.headers['x-session-id']
            }
        });

        await newReview.save();

        // Update user statistics
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { 'statistics.reviewsSubmitted': 1 },
            $set: { 'statistics.lastReviewDate': new Date() }
        });

        // Emit notification for admin (if using socket)
        if (req.app.get('io')) {
            req.app.get('io').to('admin').emit('newReview', {
                reviewId: newReview._id,
                userName: newReview.userName,
                rating: newReview.rating,
                review: newReview.review,
                timestamp: new Date()
            });
        }

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully. It will be visible after admin approval.',
            review: {
                _id: newReview._id,
                rating: newReview.rating,
                review: newReview.review,
                status: newReview.status,
                createdAt: newReview.createdAt
            }
        });

    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit review',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get public reviews (approved only)
exports.getPublicReviews = async (req, res) => {
    try {
        const { 
            rating, 
            sortBy = 'createdAt', 
            sortOrder = 'desc',
            page = 1,
            limit = 10,
            appStore
        } = req.query;

        const filter = { status: 'approved' };
        
        if (rating) filter.rating = parseInt(rating);
        if (appStore) filter.appStore = appStore;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortDirection = sortOrder === 'desc' ? -1 : 1;

        // Get reviews with pagination
        const reviews = await AppReview.find(filter)
            .sort({ [sortBy]: sortDirection, _id: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Get statistics
        const totalReviews = await AppReview.countDocuments({ status: 'approved' });
        const averageRatingResult = await AppReview.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: null, avgRating: { $avg: '$rating' } } }
        ]);
        
        const ratingDistribution = await AppReview.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: '$rating', count: { $sum: 1 } } },
            { $sort: { _id: -1 } }
        ]);

        const averageRating = averageRatingResult[0]?.avgRating || 0;
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        ratingDistribution.forEach(item => {
            distribution[item._id] = item.count;
        });

        res.status(200).json({
            success: true,
            reviews,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalReviews,
                pages: Math.ceil(totalReviews / parseInt(limit))
            },
            stats: {
                averageRating: parseFloat(averageRating.toFixed(1)),
                totalReviews,
                ratingDistribution: distribution
            }
        });

    } catch (error) {
        console.error('Get public reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reviews'
        });
    }
};

// Get pending reviews (Admin only)
exports.getPendingReviews = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const reviews = await AppReview.find({ status: 'pending' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'name email')
            .lean();

        const total = await AppReview.countDocuments({ status: 'pending' });

        res.status(200).json({
            success: true,
            reviews,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get pending reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending reviews'
        });
    }
};

// Update review status (Approve/Reject - Admin only)
exports.updateReviewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminResponse } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "approved" or "rejected"'
            });
        }

        const updateData = { 
            status,
            ...(status === 'approved' && { isFeatured: false }) // Reset featured status
        };

        if (adminResponse && adminResponse.trim()) {
            updateData.adminResponse = {
                text: adminResponse.trim(),
                respondedBy: req.user._id,
                respondedAt: new Date()
            };
        }

        const review = await AppReview.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('userId', 'name email');

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Emit notification to user (if using socket)
        if (req.app.get('io')) {
            const userSocket = req.app.get('io').sockets.sockets.get(review.userId.toString());
            if (userSocket) {
                userSocket.emit('reviewStatusUpdated', {
                    reviewId: review._id,
                    status: review.status,
                    adminResponse: review.adminResponse,
                    timestamp: new Date()
                });
            }
        }

        res.status(200).json({
            success: true,
            message: `Review ${status} successfully`,
            review
        });

    } catch (error) {
        console.error('Update review status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update review status'
        });
    }
};

// Mark review as helpful
exports.markHelpful = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        // Check if user already voted
        const review = await AppReview.findById(id);
        
        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check if user is trying to vote on their own review
        if (review.userId.toString() === userId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot vote on your own review'
            });
        }

        // Increment helpful votes
        review.helpfulVotes += 1;
        await review.save();

        res.status(200).json({
            success: true,
            message: 'Review marked as helpful',
            helpfulVotes: review.helpfulVotes
        });

    } catch (error) {
        console.error('Mark helpful error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark review as helpful'
        });
    }
};

// Track share analytics
exports.trackShare = async (req, res) => {
    try {
        const { platform, shareMethod, sharedUrl, campaign, tags } = req.body;

        const shareAnalytics = new ShareAnalytics({
            userId: req.user._id,
            userName: req.user.name,
            userEmail: req.user.email,
            platform,
            shareMethod,
            sharedUrl: sharedUrl || req.headers.referer || 'Unknown',
            deviceInfo: {
                userAgent: req.headers['user-agent'],
                ...req.body.deviceInfo
            },
            location: {
                ipAddress: req.ip,
                ...req.body.location
            },
            sessionId: req.headers['x-session-id'],
            referrer: req.headers.referer,
            campaign,
            tags
        });

        await shareAnalytics.save();

        // Update user statistics
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { 'statistics.sharesMade': 1 }
        });

        res.status(200).json({
            success: true,
            message: 'Share tracked successfully'
        });

    } catch (error) {
        console.error('Track share error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track share'
        });
    }
};

// Get share analytics (Admin only)
exports.getShareAnalytics = async (req, res) => {
    try {
        const { startDate, endDate, platform, groupBy = 'day' } = req.query;
        
        const matchStage = {};
        
        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) matchStage.createdAt.$gte = new Date(startDate);
            if (endDate) matchStage.createdAt.$lte = new Date(endDate);
        }
        
        if (platform) matchStage.platform = platform;

        const analytics = await ShareAnalytics.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        [groupBy === 'day' ? '$dayOfYear' : 
                         groupBy === 'month' ? '$month' : 
                         groupBy === 'year' ? '$year' : 'dayOfYear']: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        platform: '$platform'
                    },
                    count: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            { $sort: { '_id.date': -1 } }
        ]);

        const totalShares = await ShareAnalytics.countDocuments(matchStage);
        const uniqueUsers = await ShareAnalytics.distinct('userId', matchStage);

        res.status(200).json({
            success: true,
            analytics,
            summary: {
                totalShares,
                uniqueUsers: uniqueUsers.length,
                startDate: startDate || 'Beginning',
                endDate: endDate || new Date().toISOString().split('T')[0]
            }
        });

    } catch (error) {
        console.error('Get share analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch share analytics'
        });
    }
};

// Get review statistics
exports.getStatistics = async (req, res) => {
    try {
        const [
            totalReviews,
            pendingReviews,
            approvedReviews,
            rejectedReviews,
            averageRating,
            recentReviews,
            topPlatforms
        ] = await Promise.all([
            AppReview.countDocuments(),
            AppReview.countDocuments({ status: 'pending' }),
            AppReview.countDocuments({ status: 'approved' }),
            AppReview.countDocuments({ status: 'rejected' }),
            AppReview.aggregate([
                { $group: { _id: null, avg: { $avg: '$rating' } } }
            ]),
            AppReview.find({ status: 'approved' })
                .sort({ helpfulVotes: -1 })
                .limit(5)
                .lean(),
            AppReview.aggregate([
                { $group: { _id: '$appStore', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ])
        ]);

        const ratingDistribution = await AppReview.aggregate([
            { $group: { _id: '$rating', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratingDistribution.forEach(item => {
            distribution[item._id] = item.count;
        });

        res.status(200).json({
            success: true,
            statistics: {
                totalReviews,
                pendingReviews,
                approvedReviews,
                rejectedReviews,
                averageRating: averageRating[0]?.avg ? parseFloat(averageRating[0].avg.toFixed(2)) : 0,
                ratingDistribution: distribution,
                recentReviews,
                topPlatforms
            }
        });

    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
};