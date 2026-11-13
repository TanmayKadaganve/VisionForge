import express from 'express';
import {
  getDemandForecastData,
  getZoneAnalytics,
  getRepositioningRecommendations,
  getRidePoolingRecommendations,
  getAllocationComparison,
} from '../controllers/mlZoneController.js';

const router = express.Router();

router.get('/forecast', getDemandForecastData);
router.get('/zones', getZoneAnalytics);
router.get('/repositioning', getRepositioningRecommendations);
router.get('/pooling', getRidePoolingRecommendations);
router.get('/allocation-comparison', getAllocationComparison);

export default router;
