import express from 'express';
import {
  getAdminOverview,
  getLiveOperationsMap,
  getAdminPassengers,
  getAdminDrivers,
  getAdminRides,
  getExceptionLogs,
  getOperationsAnalytics,
} from '../controllers/adminController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Allow admin access
router.use(verifyToken);
router.use(requireRole('admin'));

router.get('/overview', getAdminOverview);
router.get('/live-map', getLiveOperationsMap);
router.get('/passengers', getAdminPassengers);
router.get('/drivers', getAdminDrivers);
router.get('/rides', getAdminRides);
router.get('/exceptions', getExceptionLogs);
router.get('/analytics', getOperationsAnalytics);

export default router;
