import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { Driver } from '../models/Driver.js';
import { Ride } from '../models/Ride.js';
import { DriverLocation } from '../models/DriverLocation.js';
import { triggerAutomaticReassignment } from '../services/reassignmentService.js';

export const setupSocketIO = (io) => {
  // Middleware for optional socket authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
      } catch (err) {
        console.warn('[Socket.IO] Invalid token on handshake:', err.message);
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join user specific room
    socket.on('join_user_room', ({ userId, role, driverId }) => {
      if (userId) {
        const userRoom = role === 'driver' ? `driver_${driverId || userId}` : `passenger_${userId}`;
        socket.join(userRoom);
        console.log(`[Socket.IO] Socket ${socket.id} joined user room: ${userRoom}`);
      }

      if (role === 'admin') {
        socket.join('admin_operations');
        console.log(`[Socket.IO] Socket ${socket.id} joined admin_operations room`);
      }
    });

    // Join ride-specific live room for real-time tracking
    socket.on('join_ride', ({ rideId }) => {
      if (rideId) {
        socket.join(`ride_${rideId}`);
        console.log(`[Socket.IO] Socket ${socket.id} joined ride room: ride_${rideId}`);
      }
    });

    socket.on('leave_ride', ({ rideId }) => {
      if (rideId) {
        socket.leave(`ride_${rideId}`);
      }
    });

    // Driver location ping
    socket.on('driver_location_ping', async (data) => {
      const { driverId, coordinates, heading = 0, speed = 0, activeRideId } = data;
      if (!driverId || !coordinates) return;

      try {
        await Driver.findByIdAndUpdate(driverId, {
          'currentLocation.coordinates': coordinates,
          'currentLocation.heading': heading,
          'currentLocation.speed': speed,
          'currentLocation.lastUpdated': new Date(),
        });

        // Broadcast to specific active ride room
        if (activeRideId) {
          io.to(`ride_${activeRideId}`).emit('driver_location_update', {
            driverId,
            coordinates,
            heading,
            speed,
            timestamp: Date.now(),
          });
        }

        // Broadcast to admin operations map
        io.to('admin_operations').emit('driver_moved', {
          driverId,
          coordinates,
          heading,
          speed,
        });
      } catch (err) {
        console.error('[Socket.IO] Location ping error:', err.message);
      }
    });

    // Simulated driver movement along route polyline
    socket.on('simulate_driver_route', async ({ rideId, driverId, coordinatesList, intervalMs = 1500 }) => {
      if (!coordinatesList || coordinatesList.length === 0) return;

      let stepIndex = 0;
      const interval = setInterval(async () => {
        if (stepIndex >= coordinatesList.length) {
          clearInterval(interval);
          return;
        }

        const point = coordinatesList[stepIndex];
        const nextPoint = coordinatesList[stepIndex + 1] || point;
        const heading = Math.round(
          Math.atan2(nextPoint[1] - point[1], nextPoint[0] - point[0]) * (180 / Math.PI)
        );

        io.to(`ride_${rideId}`).emit('driver_location_update', {
          rideId,
          driverId,
          coordinates: point,
          heading,
          speed: 32,
          stepIndex,
          totalSteps: coordinatesList.length,
          timestamp: Date.now(),
        });

        // Update driver model
        if (driverId) {
          await Driver.findByIdAndUpdate(driverId, {
            'currentLocation.coordinates': point,
            'currentLocation.heading': heading,
            'currentLocation.lastUpdated': new Date(),
          });
        }

        stepIndex++;
      }, intervalMs);

      // Clean up timer if socket disconnects
      socket.on('disconnect', () => {
        clearInterval(interval);
      });
    });

    // Driver rejects or times out on offer
    socket.on('driver_timeout', async ({ rideId, driverId }) => {
      console.log(`[Socket.IO] Driver ${driverId} timed out on ride ${rideId}. Triggering auto-reassignment.`);
      try {
        await triggerAutomaticReassignment({
          rideId,
          driverId,
          reason: 'TIMEOUT',
          io,
        });
      } catch (err) {
        console.error('[Socket.IO] Auto-reassignment error on timeout:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
};
