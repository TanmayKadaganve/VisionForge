import express from 'express';
import {
  getFareQuote,
  getNearbyDrivers,
  createRideRequest,
  getRideDetails,
  acceptRideRequest,
  rejectRideRequest,
  updateRideStatus,
  cancelRide,
  rateRide,
} from '../controllers/rideController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Public / Quote
router.post('/quote', getFareQuote);
router.get('/nearby', getNearbyDrivers);

// Authenticated
router.post('/request', verifyToken, createRideRequest);
router.get('/:id', verifyToken, getRideDetails);
router.post('/:rideId/accept', verifyToken, acceptRideRequest);
router.post('/:rideId/reject', verifyToken, rejectRideRequest);
router.patch('/:rideId/status', verifyToken, updateRideStatus);
router.post('/:rideId/cancel', verifyToken, cancelRide);
router.post('/:rideId/rate', verifyToken, rateRide);

export default router;
