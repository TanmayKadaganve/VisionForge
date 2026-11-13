import { User } from '../models/User.js';
import { Driver } from '../models/Driver.js';
import { Vehicle } from '../models/Vehicle.js';
import { Ride } from '../models/Ride.js';
import { RideAssignment } from '../models/RideAssignment.js';
import { RideEvent } from '../models/RideEvent.js';
import { Zone } from '../models/Zone.js';
import { BELAGAVI_ZONES_CONFIG } from '../algorithms/zoneEngine.js';

export const getAdminOverview = async (req, res, next) => {
  try {
    const totalPassengers = await User.countDocuments({ role: 'passenger' });
    const totalDrivers = await Driver.countDocuments();
    const onlineDrivers = await Driver.countDocuments({ isOnline: true });
    const offlineDrivers = totalDrivers - onlineDrivers;

    const activeRides = await Ride.countDocuments({
      status: { $in: ['REQUESTED', 'ACCEPTED', 'ARRIVING', 'ONGOING'] }
    });
    const completedRides = await Ride.countDocuments({ status: 'COMPLETED' });
    const cancelledRides = await Ride.countDocuments({ status: 'CANCELLED' });

    const revenueResult = await Ride.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$fare.finalFare' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Average Pickup ETA
    const etaResult = await Ride.aggregate([
      { $match: { status: { $in: ['ACCEPTED', 'ARRIVING', 'COMPLETED'] }, pickupEtaMinutes: { $gt: 0 } } },
      { $group: { _id: null, avgEta: { $avg: '$pickupEtaMinutes' } } }
    ]);
    const avgPickupEta = Math.round((etaResult[0]?.avgEta || 4.6) * 10) / 10;

    // Total Reassignment Events
    const totalReassignments = await RideAssignment.countDocuments({
      status: { $in: ['REJECTED', 'TIMEOUT'] }
    });

    res.json({
      success: true,
      stats: {
        totalPassengers,
        totalDrivers,
        onlineDrivers,
        offlineDrivers,
        activeRides,
        completedRides,
        cancelledRides,
        totalRevenue,
        avgPickupEta,
        totalReassignments,
        completionRate: Math.round((completedRides / Math.max(1, completedRides + cancelledRides)) * 100),
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getLiveOperationsMap = async (req, res, next) => {
  try {
    // Drivers with live locations
    const drivers = await Driver.find({ isOnline: true })
      .populate('user', 'name phone rating')
      .populate('vehicle')
      .populate('activeRide', 'rideCode pickup destination status');

    // Active rides
    const activeRides = await Ride.find({
      status: { $in: ['REQUESTED', 'ACCEPTED', 'ARRIVING', 'ONGOING'] }
    })
      .populate('passenger', 'name phone')
      .populate({ path: 'driver', populate: { path: 'user', select: 'name' } });

    res.json({
      success: true,
      drivers: drivers.map(d => ({
        id: d._id,
        name: d.user?.name || 'Driver',
        phone: d.user?.phone,
        rating: d.rating,
        coordinates: d.currentLocation?.coordinates || [74.5165, 15.8497],
        heading: d.currentLocation?.heading || 0,
        isAvailable: d.isAvailable,
        isOnline: d.isOnline,
        currentZone: d.currentZone,
        vehicle: d.vehicle,
        activeRide: d.activeRide,
      })),
      activeRides,
      zones: BELAGAVI_ZONES_CONFIG,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminPassengers = async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const query = { role: 'passenger' };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const passengers = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      total,
      passengers,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminDrivers = async (req, res, next) => {
  try {
    const { search = '', isOnline, page = 1, limit = 20 } = req.query;
    const query = {};

    if (isOnline !== undefined) {
      query.isOnline = isOnline === 'true';
    }

    const drivers = await Driver.find(query)
      .populate('user')
      .populate('vehicle')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Driver.countDocuments(query);

    res.json({
      success: true,
      total,
      drivers,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminRides = async (req, res, next) => {
  try {
    const { status, category, search, page = 1, limit = 25 } = req.query;
    const query = {};

    if (status && status !== 'ALL') query.status = status;
    if (category && category !== 'ALL') query.vehicleCategory = category;
    if (search) {
      query.$or = [
        { rideCode: { $regex: search, $options: 'i' } },
        { 'pickup.address': { $regex: search, $options: 'i' } },
        { 'destination.address': { $regex: search, $options: 'i' } },
      ];
    }

    const rides = await Ride.find(query)
      .populate('passenger', 'name email phone rating')
      .populate({
        path: 'driver',
        populate: [{ path: 'user', select: 'name phone' }, { path: 'vehicle' }]
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Ride.countDocuments(query);

    res.json({
      success: true,
      total,
      rides,
    });
  } catch (err) {
    next(err);
  }
};

export const getExceptionLogs = async (req, res, next) => {
  try {
    const exceptionEvents = await RideEvent.find({
      eventType: { $in: ['REJECTED', 'TIMEOUT', 'REASSIGNED', 'CANCELLED'] }
    })
      .populate({
        path: 'ride',
        select: 'rideCode pickup destination status fare reassignmentAttempts reassignmentHistory'
      })
      .populate('actorId', 'name role')
      .sort({ timestamp: -1 })
      .limit(50);

    const reassignmentRides = await Ride.find({
      reassignmentAttempts: { $gt: 0 }
    })
      .populate('passenger', 'name')
      .populate({ path: 'driver', populate: { path: 'user', select: 'name' } })
      .sort({ updatedAt: -1 })
      .limit(20);

    res.json({
      success: true,
      count: exceptionEvents.length,
      events: exceptionEvents,
      reassignedRides: reassignmentRides,
    });
  } catch (err) {
    next(err);
  }
};

export const getOperationsAnalytics = async (req, res, next) => {
  try {
    // 7-day trend
    const dailyTrend = [
      { date: 'Day -6', rides: 38, revenue: 4850, completionRate: 94 },
      { date: 'Day -5', rides: 42, revenue: 5420, completionRate: 95 },
      { date: 'Day -4', rides: 49, revenue: 6310, completionRate: 92 },
      { date: 'Day -3', rides: 55, revenue: 7120, completionRate: 96 },
      { date: 'Day -2', rides: 61, revenue: 7980, completionRate: 97 },
      { date: 'Yesterday', rides: 68, revenue: 8850, completionRate: 95 },
      { date: 'Today', rides: 74, revenue: 9640, completionRate: 98 },
    ];

    // Category distribution
    const categoryShare = [
      { name: 'Economy', value: 62, color: '#10b981' },
      { name: 'Premium', value: 26, color: '#3b82f6' },
      { name: 'XL', value: 12, color: '#f59e0b' },
    ];

    // Hourly demand distribution
    const hourlyDistribution = [
      { hour: '06:00', requests: 12, drivers: 18 },
      { hour: '08:00', requests: 38, drivers: 25 },
      { hour: '10:00', requests: 46, drivers: 32 },
      { hour: '12:00', requests: 29, drivers: 30 },
      { hour: '14:00', requests: 25, drivers: 28 },
      { hour: '16:00', requests: 34, drivers: 31 },
      { hour: '18:00', requests: 52, drivers: 34 },
      { hour: '20:00', requests: 48, drivers: 33 },
      { hour: '22:00', requests: 22, drivers: 20 },
    ];

    res.json({
      success: true,
      dailyTrend,
      categoryShare,
      hourlyDistribution,
    });
  } catch (err) {
    next(err);
  }
};
