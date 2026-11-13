import { Ride } from '../models/Ride.js';
import { Driver } from '../models/Driver.js';
import { RideAssignment } from '../models/RideAssignment.js';
import { RideEvent } from '../models/RideEvent.js';
import { rankDriversForPickup } from '../algorithms/matchingEngine.js';

export const MAX_REASSIGNMENT_ATTEMPTS = 3;

/**
 * Handle Driver Rejection, Timeout, or Cancellation with Automatic Reassignment
 */
export const triggerAutomaticReassignment = async ({
  rideId,
  driverId,
  reason = 'REJECTED', // 'REJECTED' | 'TIMEOUT' | 'CANCELLED'
  io = null,
}) => {
  const ride = await Ride.findById(rideId).populate('passenger');
  if (!ride) {
    throw new Error('Ride not found');
  }

  // If ride is already accepted by someone else or already completed/cancelled, stop
  if (ride.status === 'COMPLETED' || (ride.status === 'ACCEPTED' && ride.driver && ride.driver.toString() !== driverId?.toString())) {
    return { reassigned: false, message: 'Ride is no longer awaiting reassignment' };
  }

  // 1. Update previous assignment record
  if (driverId) {
    await RideAssignment.findOneAndUpdate(
      { ride: ride._id, driver: driverId, status: 'OFFERED' },
      { status: reason, respondedAt: new Date(), notes: `Driver ${reason.toLowerCase()}` }
    );

    // Free previous driver availability if needed
    await Driver.findByIdAndUpdate(driverId, {
      isAvailable: true,
      activeRide: null,
    });
  }

  // 2. Add driver to excluded list to prevent ping-pong loops
  if (driverId && !ride.excludedDriverIds.some(id => id.toString() === driverId.toString())) {
    ride.excludedDriverIds.push(driverId);
  }

  // Record history
  const prevDriver = driverId ? await Driver.findById(driverId).populate('user') : null;
  ride.reassignmentHistory.push({
    attempt: (ride.reassignmentAttempts || 0) + 1,
    driverId,
    driverName: prevDriver?.user?.name || 'Driver',
    reason,
    timestamp: new Date(),
  });

  // Log audit event
  await RideEvent.create({
    ride: ride._id,
    eventType: reason === 'TIMEOUT' ? 'TIMEOUT' : (reason === 'REJECTED' ? 'REJECTED' : 'CANCELLED'),
    actorRole: 'DRIVER',
    actorId: prevDriver?.user?._id || null,
    payload: {
      driverId,
      attempt: ride.reassignmentAttempts + 1,
      reason,
    }
  });

  // Check attempt limit
  if (ride.reassignmentAttempts >= MAX_REASSIGNMENT_ATTEMPTS) {
    ride.status = 'CANCELLED';
    ride.cancelledBy = 'SYSTEM';
    ride.cancelReason = `Exceeded maximum auto-reassignment attempts (${MAX_REASSIGNMENT_ATTEMPTS}). No drivers accepted.`;
    await ride.save();

    await RideEvent.create({
      ride: ride._id,
      eventType: 'CANCELLED',
      actorRole: 'SYSTEM',
      payload: { reason: ride.cancelReason }
    });

    if (io) {
      io.to(`ride_${ride._id}`).emit('ride_status_updated', {
        rideId: ride._id,
        status: 'CANCELLED',
        reason: ride.cancelReason,
      });
      io.to(`passenger_${ride.passenger._id}`).emit('ride_cancelled', {
        rideId: ride._id,
        reason: ride.cancelReason,
      });
    }

    return {
      reassigned: false,
      exhausted: true,
      message: 'Maximum reassignment attempts reached without driver acceptance'
    };
  }

  // 3. Search for the next best eligible driver
  const allDrivers = await Driver.find({ isOnline: true, isAvailable: true })
    .populate('user')
    .populate('vehicle');

  const ranking = rankDriversForPickup({
    pickupCoordinates: ride.pickup.location.coordinates,
    availableDrivers: allDrivers,
    vehicleCategory: ride.vehicleCategory,
    excludedDriverIds: ride.excludedDriverIds,
  });

  if (!ranking.bestCandidate) {
    // No more candidates in range right now
    ride.reassignmentAttempts += 1;
    await ride.save();

    if (io) {
      io.to(`passenger_${ride.passenger._id}`).emit('reassignment_waiting', {
        rideId: ride._id,
        attempt: ride.reassignmentAttempts,
        message: 'Previous driver was unavailable. Searching for more nearby drivers...',
      });
    }

    return {
      reassigned: false,
      exhausted: false,
      message: 'No alternative drivers currently available in sector'
    };
  }

  // 4. Found candidate! Reassign
  const nextDriver = ranking.bestCandidate;
  ride.reassignmentAttempts += 1;
  ride.status = 'REQUESTED'; // Reset to requested for new driver
  ride.driver = null; // Awaiting acceptance
  ride.pickupEtaMinutes = nextDriver.rawMetrics.etaMinutes;
  ride.allocationFairness = {
    selectedDriverId: nextDriver.driverId,
    fairnessScore: nextDriver.finalScore,
    factorScores: nextDriver.factorScores,
    selectionExplanation: `Auto-Reassigned (Attempt ${ride.reassignmentAttempts}): ${ranking.explanation}`,
    candidateRank: nextDriver.rank,
    totalCandidatesEvaluated: ranking.totalEvaluated,
  };
  await ride.save();

  // Create new assignment record
  const newAssignment = await RideAssignment.create({
    ride: ride._id,
    driver: nextDriver.driverId,
    attemptNumber: ride.reassignmentAttempts,
    status: 'OFFERED',
    fairnessScore: nextDriver.finalScore,
    metrics: {
      distanceKm: nextDriver.rawMetrics.distanceKm,
      etaMinutes: nextDriver.rawMetrics.etaMinutes,
      workloadToday: nextDriver.rawMetrics.todayRides,
      idleMinutes: nextDriver.rawMetrics.idleMinutes,
      acceptanceRate: nextDriver.rawMetrics.acceptanceRate,
    },
    timeoutAt: new Date(Date.now() + 15 * 1000), // 15 second decision timer
  });

  await RideEvent.create({
    ride: ride._id,
    eventType: 'REASSIGNED',
    actorRole: 'SYSTEM',
    payload: {
      newDriverId: nextDriver.driverId,
      attemptNumber: ride.reassignmentAttempts,
      fairnessScore: nextDriver.finalScore,
    }
  });

  // 5. Notify via Socket.IO
  if (io) {
    // Notify the newly assigned driver
    io.to(`driver_${nextDriver.driverId}`).emit('new_ride_request', {
      rideId: ride._id,
      rideCode: ride.rideCode,
      assignmentId: newAssignment._id,
      pickup: ride.pickup,
      destination: ride.destination,
      distanceKm: ride.distanceKm,
      durationMinutes: ride.durationMinutes,
      fare: ride.fare,
      category: ride.vehicleCategory,
      pickupDistanceKm: nextDriver.rawMetrics.distanceKm,
      pickupEtaMin: nextDriver.rawMetrics.etaMinutes,
      timeoutSeconds: 15,
      isReassignment: true,
      attemptNumber: ride.reassignmentAttempts,
    });

    // Notify passenger with reassignment progress
    io.to(`passenger_${ride.passenger._id}`).emit('driver_reassigned', {
      rideId: ride._id,
      attemptNumber: ride.reassignmentAttempts,
      message: `Previous driver was unavailable (${reason.toLowerCase()}). Instantly re-routed to ${nextDriver.driverName} (~${nextDriver.rawMetrics.etaMinutes} mins away).`,
      newCandidate: {
        driverName: nextDriver.driverName,
        rating: nextDriver.rating,
        model: nextDriver.vehicleModel,
        etaMinutes: nextDriver.rawMetrics.etaMinutes,
        score: nextDriver.finalScore,
      }
    });

    // Notify admin operations room
    io.to('admin_operations').emit('exception_event', {
      type: reason,
      rideId: ride._id,
      previousDriverId: driverId,
      newDriverId: nextDriver.driverId,
      attempt: ride.reassignmentAttempts,
      timestamp: new Date(),
    });
  }

  return {
    reassigned: true,
    newDriverId: nextDriver.driverId,
    attempt: ride.reassignmentAttempts,
    message: `Ride reassigned to ${nextDriver.driverName}`
  };
};
