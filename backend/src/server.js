import express from 'express';
import http from 'http';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Server } = require('socket.io');
import cors from 'cors';
import { PORT, CORS_ORIGIN } from './config/env.js';
import { connectDB } from './config/db.js';
import { seedDatabase } from './utils/seed.js';
import { setupSocketIO } from './sockets/socketHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route Imports
import authRoutes from './routes/authRoutes.js';
import passengerRoutes from './routes/passengerRoutes.js';
import driverRoutes from './routes/driverRoutes.js';
import rideRoutes from './routes/rideRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import mlZoneRoutes from './routes/mlZoneRoutes.js';

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true,
  }
});

// Attach io instance to express app for access in controllers
app.set('io', io);

// Global Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());

// Request logger for API calls
app.use((req, res, next) => {
  if (!req.url.startsWith('/socket.io')) {
    console.log(`[API] ${req.method} ${req.url}`);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'VisionForge Intelligent Ride Hailing Platform',
    operatingArea: 'Belagavi, Karnataka, India',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/passenger', passengerRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ml', mlZoneRoutes);

// Centralized error handler
app.use(errorHandler);

// Setup Socket.IO Event Handlers
setupSocketIO(io);

// Start server
const startServer = async () => {
  try {
    await connectDB();
    await seedDatabase();

    server.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 VISIONFORGE RIDE-HAILING BACKEND ACTIVE`);
      console.log(`📡 HTTP Server running on: http://localhost:${PORT}`);
      console.log(`⚡ Socket.IO listening on: ws://localhost:${PORT}`);
      console.log(`📍 Operating Area: Belagavi, Karnataka, India`);
      console.log(`======================================================\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

export { app, server, io };
