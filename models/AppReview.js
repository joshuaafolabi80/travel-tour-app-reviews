// travel-tour-app-reviews/models/AppReview.js

const mongoose = require('mongoose');

const AppReviewSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        validate: {
            validator: Number.isInteger,
            message: 'Rating must be an integer'
        }
    },
    review: {
        type: String,
        trim: true,
        maxlength: 2000
    },
    appStore: {
        type: String,
        enum: ['google-play', 'apple-store', 'huawei', 'samsung', 'web'],
        default: 'web'
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    deviceInfo: {
        deviceType: String,
        os: String,
        browser: String,
        userAgent: String
    },
    helpfulVotes: {
        type: Number,
        default: 0
    },
    unhelpfulVotes: {
        type: Number,
        default: 0
    },
    reportCount: {
        type: Number,
        default: 0
    },
    adminResponse: {
        text: {
            type: String,
            maxlength: 1000
        },
        respondedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        respondedAt: {
            type: Date
        }
    },
    flags: [{
        userId: mongoose.Schema.Types.ObjectId,
        reason: String,
        createdAt: Date
    }],
    metadata: {
        ipAddress: String,
        location: {
            country: String,
            city: String,
            region: String
        },
        sessionId: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better performance
AppReviewSchema.index({ status: 1, createdAt: -1 });
AppReviewSchema.index({ userId: 1 });
AppReviewSchema.index({ rating: 1 });
AppReviewSchema.index({ appStore: 1 });
AppReviewSchema.index({ helpfulVotes: -1 });
AppReviewSchema.index({ createdAt: -1 });

// Virtual for formatted date
AppReviewSchema.virtual('formattedDate').get(function() {
    return this.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

// Pre-save middleware
AppReviewSchema.pre('save', function(next) {
    if (this.review) {
        this.review = this.review.trim();
    }
    next();
});

module.exports = mongoose.model('AppReview', AppReviewSchema);
