import express from 'express';
import {
  registerPassenger,
  registerDriver,
  login,
  getMe,
  getDemoAccounts,
} from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register/passenger', registerPassenger);
router.post('/register/driver', registerDriver);
router.post('/login', login);
router.get('/me', verifyToken, getMe);
router.get('/demo-accounts', getDemoAccounts);

export default router;
