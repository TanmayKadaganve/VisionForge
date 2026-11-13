import { Ride } from '../models/Ride.js';
import { Driver } from '../models/Driver.js';
import { User } from '../models/User.js';
import { Zone } from '../models/Zone.js';
import { Payment } from '../models/Payment.js';
import { RideAssignment } from '../models/RideAssignment.js';
import { RideEvent } from '../models/RideEvent.js';
import { fetchRoute, calculateHaversineDistance, estimateTravelTimeMinutes } from '../utils/geo.js';
import { calculateFare, VEHICLE_RATES } from '../utils/fareCalculator.js';
import { rankDriversForPickup } from '../algorithms/matchingEngine.js';
import { identifyZoneForCoordinates, calculateSurgeForZone } from '../algorithms/zoneEngine.js';
import { triggerAutomaticReassignment } from '../services/reassignmentService.js';

export const getFareQuote = async (req, res, next) => {
  try {
    const { pickupCoordinates, destinationCoordinates, pickupAddress, destinationAddress } = req.body;

    if (!pickupCoordinates || !destinationCoordinates) {
      return res.status(400).json({ success: false, message: 'Pickup and destination coordinates are required' });
    }

    const routeData = await fetchRoute(pickupCoordinates, destinationCoordinates);
    const zoneInfo = identifyZoneForCoordinates(pickupCoordinates);

    // Calculate zone surge
    const dbZone = await Zone.findOne({ code: zoneInfo.code });
    const activeRequests = await Ride.countDocuments({
      'pickup.zoneCode': zoneInfo.code,
      status: { $in: ['REQUESTED', 'ACCEPTED', 'ARRIVING'] }
    });
    const availableDrivers = await Driver.countDocuments({
      isOnline: true,
      isAvailable: true,
      currentZone: zoneInfo.code
    });

    const surgeResult = calculateSurgeForZone({
      activeRequests,
      availableDrivers,
      predictedDemand: dbZone ? dbZone.predictedDemandNextHour : 8,
    });

    const quotes = {};
    for (const cat of ['Economy', 'Premium', 'XL']) {
      quotes[cat] = calculateFare({
        distanceKm: routeData.distanceKm,
        durationMinutes: routeData.durationMinutes,
        category: cat,
        surgeMultiplier: surgeResult.surgeMultiplier,
        surgeReason: surgeResult.surgeReason,
        isPooled: false,
      });
    }

    // Pooling quote
    const poolingQuote = calculateFare({
      distanceKm: routeData.distanceKm,
      durationMinutes: routeData.durationMinutes,
      category: 'Economy',
      surgeMultiplier: surgeResult.surgeMultiplier,
      surgeReason: surgeResult.surgeReason,
      isPooled: true,
    });

    res.json({
      success: true,
      route: {
        distanceKm: routeData.distanceKm,
        durationMinutes: routeData.durationMinutes,
        coordinates: routeData.coordinates,
        source: routeData.source,
      },
      zone: {
        code: zoneInfo.code,
        name: zoneInfo.name,
        classification: surgeResult.classification,
        surgeMultiplier: surgeResult.surgeMultiplier,
        surgeReason: surgeResult.surgeReason,
        activeRequests,
        availableDrivers,
      },
      quotes,
      poolingQuote,
    });
  } catch (err) {
    next(err);
  }
};

export const getNearbyDrivers = async (req, res, next) => {
  try {
    const { lng, lat, category, radiusKm = 10 } = req.query;
    const center = [parseFloat(lng) || 74.5165, parseFloat(lat) || 15.8497];

    const drivers = await Driver.find({ isOnline: true, isAvailable: true })
      .populate('user', 'name phone rating avatar')
      .populate('vehicle');

    const nearby = drivers
      .map(driver => {
        const coords = driver.currentLocation?.coordinates || [74.5165, 15.8497];
        const distKm = calculateHaversineDistance(coords, center);
        const etaMin = estimateTravelTimeMinutes(distKm);

        return {
          id: driver._id,
          name: driver.user?.name || 'Driver',
          phone: driver.user?.phone,
          rating: driver.rating,
          coordinates: coords,
          distanceKm: distKm,
          etaMinutes: etaMin,
          vehicle: driver.vehicle,
          currentZone: driver.currentZone,
          acceptanceRate: driver.acceptanceRate,
        };
      })
      .filter(d => d.distanceKm <= parseFloat(radiusKm))
      .filter(d => !category || d.vehicle?.category === category)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({
      success: true,
      count: nearby.length,
      drivers: nearby,
    });
  } catch (err) {
    next(err);
  }
};

export const createRideRequest = async (req, res, next) => {
  try {
    const {
      pickup,
      destination,
      vehicleCategory = 'Economy',
      paymentMethod = 'UPI',
      isPooled = false,
    } = req.body;

    if (!pickup?.coordinates || !destination?.coordinates) {
      return res.status(400).json({ success: false, message: 'Pickup and destination are required' });
    }

    const passengerId = req.user._id;

    // Fetch route and distance
    const routeData = await fetchRoute(pickup.coordinates, destination.coordinates);
    const pickupZone = identifyZoneForCoordinates(pickup.coordinates);
    const destZone = identifyZoneForCoordinates(destination.coordinates);

    // Calculate dynamic surge
    const activeRequests = await Ride.countDocuments({
      'pickup.zoneCode': pickupZone.code,
      status: { $in: ['REQUESTED', 'ACCEPTED', 'ARRIVING'] }
    });
    const availableDriversCount = await Driver.countDocuments({
      isOnline: true,
      isAvailable: true,
      currentZone: pickupZone.code
    });
    const surge = calculateSurgeForZone({
      activeRequests,
      availableDrivers: availableDriversCount,
    });

    const fareBreakdown = calculateFare({
      distanceKm: routeData.distanceKm,
      durationMinutes: routeData.durationMinutes,
      category: vehicleCategory,
      surgeMultiplier: surge.surgeMultiplier,
      surgeReason: surge.surgeReason,
      isPooled,
    });

    // 1. Create Ride record in DB
    const ride = await Ride.create({
      passenger: passengerId,
      vehicleCategory,
      status: 'REQUESTED',
      pickup: {
        address: pickup.address || 'Pickup Point, Belagavi',
        location: { type: 'Point', coordinates: pickup.coordinates },
        zoneCode: pickupZone.code,
      },
      destination: {
        address: destination.address || 'Destination Point, Belagavi',
        location: { type: 'Point', coordinates: destination.coordinates },
        zoneCode: destZone.code,
      },
      distanceKm: routeData.distanceKm,
      durationMinutes: routeData.durationMinutes,
      fare: fareBreakdown,
      paymentMethod,
      isPooled,
      routeCoordinates: routeData.coordinates,
      reassignmentAttempts: 0,
    });

    await RideEvent.create({
      ride: ride._id,
      eventType: 'REQUESTED',
      actorRole: 'PASSENGER',
      actorId: passengerId,
      payload: {
        pickup: ride.pickup.address,
        destination: ride.destination.address,
        category: vehicleCategory,
        finalFare: fareBreakdown.finalFare,
      }
    });

    // 2. Run Intelligent Driver Allocation & Fairness Scoring
    const allOnlineDrivers = await Driver.find({ isOnline: true, isAvailable: true })
      .populate('user')
      .populate('vehicle');

    const rankingResult = rankDriversForPickup({
      pickupCoordinates: pickup.coordinates,
      availableDrivers: allOnlineDrivers,
      vehicleCategory,
    });

    const io = req.app.get('io');

    if (rankingResult.bestCandidate) {
      const best = rankingResult.bestCandidate;
      ride.allocationFairness = {
        selectedDriverId: best.driverId,
        fairnessScore: best.finalScore,
        factorScores: best.factorScores,
        selectionExplanation: rankingResult.explanation,
        candidateRank: best.rank,
        totalCandidatesEvaluated: rankingResult.totalEvaluated,
      };
      ride.pickupEtaMinutes = best.rawMetrics.etaMinutes;
      await ride.save();

      // Create Assignment record
      const assignment = await RideAssignment.create({
        ride: ride._id,
        driver: best.driverId,
        attemptNumber: 1,
        status: 'OFFERED',
        fairnessScore: best.finalScore,
        metrics: {
          distanceKm: best.rawMetrics.distanceKm,
          etaMinutes: best.rawMetrics.etaMinutes,
          workloadToday: best.rawMetrics.todayRides,
          idleMinutes: best.rawMetrics.idleMinutes,
          acceptanceRate: best.rawMetrics.acceptanceRate,
        },
        timeoutAt: new Date(Date.now() + 15 * 1000),
      });

      await RideEvent.create({
        ride: ride._id,
        eventType: 'OFFERED_TO_DRIVER',
        actorRole: 'SYSTEM',
        payload: {
          driverId: best.driverId,
          assignmentId: assignment._id,
          score: best.finalScore,
        }
      });

      // Broadcast to selected driver
      if (io) {
        io.to(`driver_${best.driverId}`).emit('new_ride_request', {
          rideId: ride._id,
          rideCode: ride.rideCode,
          assignmentId: assignment._id,
          pickup: ride.pickup,
          destination: ride.destination,
          distanceKm: ride.distanceKm,
          durationMinutes: ride.durationMinutes,
          fare: ride.fare,
          category: ride.vehicleCategory,
          pickupDistanceKm: best.rawMetrics.distanceKm,
          pickupEtaMin: best.rawMetrics.etaMinutes,
          timeoutSeconds: 15,
          isReassignment: false,
          attemptNumber: 1,
        });

        // Broadcast to admin live dashboard
        io.to('admin_operations').emit('ride_created', {
          rideId: ride._id,
          rideCode: ride.rideCode,
          pickup: ride.pickup.address,
          destination: ride.destination.address,
          matchedDriverId: best.driverId,
          matchedDriverName: best.driverName,
          fairnessScore: best.finalScore,
          fare: ride.fare.finalFare,
          status: 'REQUESTED'
        });
      }
    }

    const populatedRide = await Ride.findById(ride._id)
      .populate('passenger', 'name phone rating')
      .populate({
        path: 'allocationFairness.selectedDriverId',
        populate: [{ path: 'user', select: 'name phone' }, { path: 'vehicle' }]
      });

    res.status(201).json({
      success: true,
      message: 'Ride requested and matching engine evaluated suitable drivers',
      ride: populatedRide,
      matchingResult: {
        bestCandidate: rankingResult.bestCandidate,
        allCandidatesCount: rankingResult.totalEvaluated,
        explanation: rankingResult.explanation,
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getRideDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ride = await Ride.findById(id)
      .populate('passenger', 'name phone rating avatar')
      .populate({
        path: 'driver',
        populate: [{ path: 'user', select: 'name phone rating avatar' }, { path: 'vehicle' }]
      })
      .populate('excludedDriverIds', 'licenseNumber');

    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    const events = await RideEvent.find({ ride: ride._id }).sort({ timestamp: 1 });
    const assignments = await RideAssignment.find({ ride: ride._id })
      .populate({ path: 'driver', populate: { path: 'user', select: 'name' } })
      .sort({ attemptNumber: 1 });

    res.json({
      success: true,
      ride,
      events,
      assignments,
    });
  } catch (err) {
    next(err);
  }
};

export const acceptRideRequest = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const driverUser = req.user;

    const driver = await Driver.findOne({ user: driverUser._id }).populate('vehicle');
    if (!driver) {
      return res.status(400).json({ success: false, message: 'Driver profile not found' });
    }

    const ride = await Ride.findById(rideId).populate('passenger');
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    if (ride.status !== 'REQUESTED') {
      return res.status(400).json({ success: false, message: `Ride is in ${ride.status} state and cannot be accepted` });
    }

    // Assign driver to ride
    ride.status = 'ACCEPTED';
    ride.driver = driver._id;
    ride.currentDriverLocation = driver.currentLocation?.coordinates || ride.pickup.location.coordinates;
    await ride.save();

    // Mark driver busy
    driver.isAvailable = false;
    driver.activeRide = ride._id;
    driver.totalRequestsAccepted += 1;
    driver.acceptanceRate = Math.round((driver.totalRequestsAccepted / Math.max(1, driver.totalRequestsReceived)) * 100);
    driver.lastAssignedAt = new Date();
    await driver.save();

    // Update assignment record
    await RideAssignment.findOneAndUpdate(
      { ride: ride._id, driver: driver._id, status: 'OFFERED' },
      { status: 'ACCEPTED', respondedAt: new Date() }
    );

    await RideEvent.create({
      ride: ride._id,
      eventType: 'ACCEPTED',
      actorRole: 'DRIVER',
      actorId: driverUser._id,
      payload: { driverId: driver._id, driverName: driverUser.name }
    });

    const io = req.app.get('io');
    if (io) {
      // Notify passenger
      io.to(`passenger_${ride.passenger._id}`).emit('ride_accepted', {
        rideId: ride._id,
        status: 'ACCEPTED',
        driver: {
          id: driver._id,
          name: driverUser.name,
          phone: driverUser.phone,
          rating: driver.rating,
          vehicle: driver.vehicle,
          currentLocation: driver.currentLocation,
        },
        etaMinutes: ride.pickupEtaMinutes || 4,
      });

      // Update room
      io.to(`ride_${ride._id}`).emit('ride_status_updated', {
        rideId: ride._id,
        status: 'ACCEPTED',
        driverId: driver._id,
      });

      io.to('admin_operations').emit('ride_status_changed', {
        rideId: ride._id,
        status: 'ACCEPTED',
        driverName: driverUser.name,
      });
    }

    res.json({
      success: true,
      message: 'Ride accepted successfully',
      ride,
    });
  } catch (err) {
    next(err);
  }
};

export const rejectRideRequest = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { reason = 'REJECTED' } = req.body;
    const driverUser = req.user;

    const driver = await Driver.findOne({ user: driverUser._id });
    const io = req.app.get('io');

    const result = await triggerAutomaticReassignment({
      rideId,
      driverId: driver?._id,
      reason,
      io,
    });

    res.json({
      success: true,
      message: 'Ride request declined. Reassignment triggered automatically.',
      reassignment: result,
    });
  } catch (err) {
    next(err);
  }
};

export const updateRideStatus = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body; // ARRIVING | ONGOING | COMPLETED | CANCELLED
    const driverUser = req.user;

    const ride = await Ride.findById(rideId).populate('passenger').populate('driver');
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    const validTransitions = {
      ACCEPTED: ['ARRIVING', 'CANCELLED'],
      ARRIVING: ['ONGOING', 'CANCELLED'],
      ONGOING: ['COMPLETED', 'CANCELLED'],
      REQUESTED: ['CANCELLED'],
    };

    const allowed = validTransitions[ride.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${ride.status} to ${status}`
      });
    }

    ride.status = status;
    const io = req.app.get('io');

    if (status === 'ARRIVING') {
      await RideEvent.create({
        ride: ride._id,
        eventType: 'DRIVER_ARRIVING',
        actorRole: 'DRIVER',
        actorId: driverUser._id,
      });
    } else if (status === 'ONGOING') {
      ride.startedAt = new Date();
      await RideEvent.create({
        ride: ride._id,
        eventType: 'TRIP_STARTED',
        actorRole: 'DRIVER',
        actorId: driverUser._id,
      });
    } else if (status === 'COMPLETED') {
      ride.completedAt = new Date();
      ride.paymentStatus = 'PAID';

      // Record simulated payment
      const payment = await Payment.create({
        ride: ride._id,
        passenger: ride.passenger._id,
        driver: ride.driver._id,
        amount: ride.fare.finalFare,
        method: ride.paymentMethod || 'UPI',
        status: 'SUCCESS',
        breakdown: {
          baseFare: ride.fare.baseFare,
          distanceCharge: ride.fare.distanceCharge,
          timeCharge: ride.fare.timeCharge,
          surgeAmount: ride.fare.surgeAmount || 0,
          poolingDiscount: ride.fare.poolingDiscount || 0,
          platformFee: Math.round(ride.fare.finalFare * 0.15),
          driverEarnings: Math.round(ride.fare.finalFare * 0.85),
        }
      });

      // Update Driver earnings and availability
      if (ride.driver) {
        await Driver.findByIdAndUpdate(ride.driver._id, {
          isAvailable: true,
          activeRide: null,
          $inc: {
            totalCompletedRides: 1,
            todayRidesCount: 1,
            totalEarnings: Math.round(ride.fare.finalFare * 0.85),
          }
        });
      }

      // Update Passenger rides count
      await User.findByIdAndUpdate(ride.passenger._id, {
        $inc: { totalRides: 1 }
      });

      await RideEvent.create({
        ride: ride._id,
        eventType: 'TRIP_COMPLETED',
        actorRole: 'DRIVER',
        actorId: driverUser._id,
        payload: { finalFare: ride.fare.finalFare, paymentId: payment._id }
      });
    }

    await ride.save();

    if (io) {
      io.to(`ride_${ride._id}`).emit('ride_status_updated', {
        rideId: ride._id,
        status,
        updatedAt: new Date(),
      });
      io.to(`passenger_${ride.passenger._id}`).emit('ride_status_updated', {
        rideId: ride._id,
        status,
        updatedAt: new Date(),
      });
      io.to('admin_operations').emit('ride_status_changed', {
        rideId: ride._id,
        status,
      });
    }

    res.json({
      success: true,
      message: `Ride status updated to ${status}`,
      ride,
    });
  } catch (err) {
    next(err);
  }
};

export const cancelRide = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { reason = 'Cancelled by user' } = req.body;
    const user = req.user;

    const ride = await Ride.findById(rideId).populate('passenger').populate('driver');
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    if (ride.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Cannot cancel an already completed ride' });
    }

    ride.status = 'CANCELLED';
    ride.cancelledBy = user.role.toUpperCase();
    ride.cancelReason = reason;
    ride.cancelledAt = new Date();
    await ride.save();

    // Release driver if assigned
    if (ride.driver) {
      await Driver.findByIdAndUpdate(ride.driver._id, {
        isAvailable: true,
        activeRide: null,
      });
    }

    await RideEvent.create({
      ride: ride._id,
      eventType: 'CANCELLED',
      actorRole: user.role.toUpperCase(),
      actorId: user._id,
      payload: { reason }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`ride_${ride._id}`).emit('ride_status_updated', {
        rideId: ride._id,
        status: 'CANCELLED',
        reason,
      });
    }

    res.json({
      success: true,
      message: 'Ride cancelled successfully',
      ride,
    });
  } catch (err) {
    next(err);
  }
};

export const rateRide = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { score, comment } = req.body;

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    ride.ratingByPassenger = { score, comment };
    await ride.save();

    if (ride.driver) {
      const driver = await Driver.findById(ride.driver);
      if (driver) {
        // Rolling average rating
        const newRating = Math.round(((driver.rating * 19 + score) / 20) * 100) / 100;
        driver.rating = newRating;
        await driver.save();
      }
    }

    res.json({
      success: true,
      message: 'Thank you for your rating!',
    });
  } catch (err) {
    next(err);
  }
};
