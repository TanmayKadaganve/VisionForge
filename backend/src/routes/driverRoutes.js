import express from 'express';
import {
  getDriverDashboard,
  updateAvailability,
  updateDriverLocation,
  getDriverEarnings,
  getDriverRideHistory,
} from '../controllers/driverController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);
router.use(requireRole('driver', 'admin'));

router.get('/dashboard', getDriverDashboard);
router.post('/availability', updateAvailability);
router.post('/location', updateDriverLocation);
router.get('/earnings', getDriverEarnings);
router.get('/rides', getDriverRideHistory);

export default router;
