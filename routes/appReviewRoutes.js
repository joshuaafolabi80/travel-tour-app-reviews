// travel-tour-app-reviews/routes/appReviewRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');

// Use absolute paths with __dirname. 
// Since this file is in /routes, '..' goes to the root where /middleware and /controllers live.
const middlewarePath = path.join(__dirname, '..', 'middleware', 'auth.js');
const controllerPath = path.join(__dirname, '..', 'controllers', 'appReviewController.js');

console.log(`🔍 Loading middleware from: ${middlewarePath}`);
console.log(`🔍 Loading controller from: ${controllerPath}`);

try {
  // Load middleware
  const { 
    auth, 
    adminAuth, 
    reviewLimiter, 
    shareLimiter 
  } = require(middlewarePath);
  
  // Load controller
  const {
    submitReview,
    getPublicReviews,
    getPendingReviews,
    updateReviewStatus,
    markHelpful,
    trackShare,
    getShareAnalytics,
    getStatistics
  } = require(controllerPath);
  
  console.log('✅ Routes dependencies loaded successfully');

  // Public routes
  router.get('/reviews/public', getPublicReviews);
  router.get('/stats', getStatistics);

  // User routes
  router.post('/reviews/submit', auth, reviewLimiter, submitReview);
  router.post('/reviews/:id/helpful', auth, markHelpful);
  router.post('/analytics/share', auth, shareLimiter, trackShare);

  // Admin routes
  router.get('/reviews/pending', adminAuth, getPendingReviews);
  router.put('/reviews/:id/status', adminAuth, updateReviewStatus);
  router.get('/analytics/shares', adminAuth, getShareAnalytics);

  // Test route for debugging
  router.get('/test-route', (req, res) => {
    res.json({
      success: true,
      message: 'Routes are working',
      timestamp: new Date().toISOString()
    });
  });

} catch (error) {
  console.error('❌ Failed to load routes dependencies:', error);
  
  router.get('/reviews/public', (req, res) => {
    res.status(500).json({
      success: false,
      message: 'Routes failed to load properly.',
      error: error.message
    });
  });
}

module.exports = router;