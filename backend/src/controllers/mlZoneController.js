import { Zone } from '../models/Zone.js';
import { Driver } from '../models/Driver.js';
import { Ride } from '../models/Ride.js';
import { getDemandForecast } from '../services/mlService.js';
import {
  BELAGAVI_ZONES_CONFIG,
  calculateSurgeForZone,
  generateDriverRepositioningRecommendations,
} from '../algorithms/zoneEngine.js';
import { findPoolablePairs } from '../algorithms/poolingEngine.js';
import { compareAllocationStrategies } from '../algorithms/matchingEngine.js';

export const getDemandForecastData = async (req, res, next) => {
  try {
    const { zoneCode, hour } = req.query;
    const forecastResult = await getDemandForecast({
      zoneCode: zoneCode || null,
      hour: hour !== undefined ? parseInt(hour) : null,
    });
    res.json(forecastResult);
  } catch (err) {
    next(err);
  }
};

export const getZoneAnalytics = async (req, res, next) => {
  try {
    const zonesFromDb = await Zone.find();
    const activeRides = await Ride.find({
      status: { $in: ['REQUESTED', 'ACCEPTED', 'ARRIVING', 'ONGOING'] }
    });
    const drivers = await Driver.find({ isOnline: true });

    const zonesData = BELAGAVI_ZONES_CONFIG.map(zConfig => {
      const dbZ = zonesFromDb.find(dbItem => dbItem.code === zConfig.code);
      const zoneRequests = activeRides.filter(r => r.pickup?.zoneCode === zConfig.code).length;
      const zoneDrivers = drivers.filter(d => d.currentZone === zConfig.code && d.isAvailable).length;

      const surgeData = calculateSurgeForZone({
        activeRequests: zoneRequests,
        availableDrivers: zoneDrivers,
        predictedDemand: dbZ ? dbZ.predictedDemandNextHour : 8,
      });

      return {
        code: zConfig.code,
        name: zConfig.name,
        description: zConfig.description,
        center: zConfig.center,
        polygon: zConfig.polygon,
        radiusKm: zConfig.radiusKm,
        currentDemand: zoneRequests,
        availableDrivers: zoneDrivers,
        predictedDemand: dbZ ? dbZ.predictedDemandNextHour : 12,
        demandSupplyRatio: surgeData.ratio,
        classification: surgeData.classification,
        surgeMultiplier: surgeData.surgeMultiplier,
        surgeReason: surgeData.surgeReason,
        avgPickupEtaMin: Math.max(3, Math.round(4.0 + (surgeData.ratio * 1.5))),
      };
    });

    res.json({
      success: true,
      count: zonesData.length,
      zones: zonesData,
    });
  } catch (err) {
    next(err);
  }
};

export const getRepositioningRecommendations = async (req, res, next) => {
  try {
    const zonesRes = await getZoneAnalyticsData();
    const availableDrivers = await Driver.find({ isOnline: true, isAvailable: true })
      .populate('user', 'name phone')
      .populate('vehicle');

    const recommendations = generateDriverRepositioningRecommendations({
      zones: zonesRes,
      availableDrivers,
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
    });
  } catch (err) {
    next(err);
  }
};

export const getRidePoolingRecommendations = async (req, res, next) => {
  try {
    // Look for pending or recent active requests
    const candidateRides = await Ride.find({
      status: { $in: ['REQUESTED', 'ACCEPTED', 'ARRIVING'] }
    }).populate('passenger', 'name phone rating');

    const pairs = findPoolablePairs(candidateRides);

    res.json({
      success: true,
      totalPendingRidesEvaluated: candidateRides.length,
      poolableMatchesCount: pairs.length,
      matches: pairs,
    });
  } catch (err) {
    next(err);
  }
};

export const getAllocationComparison = async (req, res, next) => {
  try {
    const recentRides = await Ride.find().sort({ createdAt: -1 }).limit(40);
    const availableDrivers = await Driver.find({ isOnline: true })
      .populate('user')
      .populate('vehicle');

    const comparison = compareAllocationStrategies(recentRides, availableDrivers);

    res.json({
      success: true,
      comparison,
    });
  } catch (err) {
    next(err);
  }
};

// Helper internal function
async function getZoneAnalyticsData() {
  const activeRides = await Ride.find({
    status: { $in: ['REQUESTED', 'ACCEPTED', 'ARRIVING', 'ONGOING'] }
  });
  const drivers = await Driver.find({ isOnline: true });

  return BELAGAVI_ZONES_CONFIG.map(zConfig => {
    const zoneRequests = activeRides.filter(r => r.pickup?.zoneCode === zConfig.code).length;
    const zoneDrivers = drivers.filter(d => d.currentZone === zConfig.code && d.isAvailable).length;

    const surgeData = calculateSurgeForZone({
      activeRequests: zoneRequests,
      availableDrivers: zoneDrivers,
    });

    return {
      code: zConfig.code,
      name: zConfig.name,
      center: zConfig.center,
      currentDemand: zoneRequests,
      availableDrivers: zoneDrivers,
      classification: surgeData.classification,
      surgeMultiplier: surgeData.surgeMultiplier,
    };
  });
}
