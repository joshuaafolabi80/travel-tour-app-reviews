// travel-tour-app-reviews/models/ShareAnalytics.js

const mongoose = require('mongoose');

const ShareAnalyticsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    userName: String,
    userEmail: String,
    platform: {
        type: String,
        required: true,
        enum: [
            'whatsapp', 'facebook', 'twitter', 'instagram', 'linkedin',
            'telegram', 'email', 'sms', 'bluetooth', 'chrome', 'files',
            'gmail', 'quickshare', 'copy', 'native-share', 'other'
        ]
    },
    shareMethod: {
        type: String,
        enum: ['just-once', 'always'],
        default: 'just-once'
    },
    sharedUrl: {
        type: String,
        required: true
    },
    deviceInfo: {
        deviceType: String,
        os: String,
        browser: String,
        screenSize: String,
        userAgent: String
    },
    location: {
        ipAddress: String,
        country: String,
        city: String,
        region: String
    },
    sessionId: String,
    referrer: String,
    campaign: String,
    tags: [String],
    success: {
        type: Boolean,
        default: true
    },
    error: String
}, {
    timestamps: true
});

// Indexes
ShareAnalyticsSchema.index({ userId: 1 });
ShareAnalyticsSchema.index({ platform: 1 });
ShareAnalyticsSchema.index({ createdAt: -1 });
ShareAnalyticsSchema.index({ sessionId: 1 });

module.exports = mongoose.model('ShareAnalytics', ShareAnalyticsSchema);