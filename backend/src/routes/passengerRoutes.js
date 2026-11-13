import express from 'express';
import {
  getPassengerProfile,
  updatePassengerProfile,
  getPassengerRideHistory,
  topUpWallet,
} from '../controllers/passengerController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);
router.use(requireRole('passenger', 'admin'));

router.get('/profile', getPassengerProfile);
router.put('/profile', updatePassengerProfile);
router.get('/rides', getPassengerRideHistory);
router.post('/wallet/topup', topUpWallet);

export default router;
