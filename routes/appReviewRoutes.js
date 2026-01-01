// travel-tour-app-reviews/routes/appReviewRoutes.js

const express = require('express');
const router = express.Router();
const { 
    auth, 
    adminAuth, 
    reviewLimiter, 
    shareLimiter 
} = require('../middleware/auth');
const {
    submitReview,
    getPublicReviews,
    getPendingReviews,
    updateReviewStatus,
    markHelpful,
    trackShare,
    getShareAnalytics,
    getStatistics
} = require('../controllers/appReviewController');

// Public routes (no auth required)
router.get('/reviews/public', getPublicReviews);
router.get('/stats', getStatistics);

// User routes (authenticated)
router.post('/reviews/submit', auth, reviewLimiter, submitReview);
router.post('/reviews/:id/helpful', auth, markHelpful);
router.post('/analytics/share', auth, shareLimiter, trackShare);

// Admin routes
router.get('/reviews/pending', adminAuth, getPendingReviews);
router.put('/reviews/:id/status', adminAuth, updateReviewStatus);
router.get('/analytics/shares', adminAuth, getShareAnalytics);

module.exports = router;