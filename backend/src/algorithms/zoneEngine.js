import { calculateHaversineDistance, estimateTravelTimeMinutes } from '../utils/geo.js';

export const BELAGAVI_ZONES_CONFIG = [
  {
    code: 'ZONE_CENTRAL',
    name: 'Belagavi Central (CBT / Market / Camp)',
    description: 'Commercial core, bus terminal, railway station, market area',
    center: [74.5165, 15.8497],
    radiusKm: 3.0,
    polygon: [
      [74.500, 15.865],
      [74.530, 15.865],
      [74.535, 15.835],
      [74.505, 15.835],
      [74.500, 15.865]
    ]
  },
  {
    code: 'ZONE_TILAKWADI',
    name: 'Tilakwadi & Congress Road',
    description: 'Residential and educational hub, 1st-3rd gates, RPD college',
    center: [74.5074, 15.8365],
    radiusKm: 2.8,
    polygon: [
      [74.490, 15.845],
      [74.515, 15.845],
      [74.515, 15.820],
      [74.490, 15.820],
      [74.490, 15.845]
    ]
  },
  {
    code: 'ZONE_NORTH_KLE',
    name: 'North Belagavi (KLE Hospital / JNMC)',
    description: 'Major medical center, university campus, Nehru Nagar',
    center: [74.5050, 15.8820],
    radiusKm: 3.2,
    polygon: [
      [74.490, 15.905],
      [74.525, 15.905],
      [74.525, 15.868],
      [74.490, 15.868],
      [74.490, 15.905]
    ]
  },
  {
    code: 'ZONE_SOUTH_ANGOL',
    name: 'South Belagavi (Angol / Udyambag)',
    description: 'Manufacturing belt, industrial estates, Shahapur market',
    center: [74.4950, 15.8120],
    radiusKm: 3.5,
    polygon: [
      [74.475, 15.825],
      [74.520, 15.825],
      [74.520, 15.795],
      [74.475, 15.795],
      [74.475, 15.825]
    ]
  },
  {
    code: 'ZONE_WEST_VTU',
    name: 'West Campus (VTU Machhe)',
    description: 'Visvesvaraya Technological University HQ, tech institutions',
    center: [74.4538, 15.7950],
    radiusKm: 3.5,
    polygon: [
      [74.430, 15.815],
      [74.470, 15.815],
      [74.470, 15.775],
      [74.430, 15.775],
      [74.430, 15.815]
    ]
  },
  {
    code: 'ZONE_EAST_AIRPORT',
    name: 'East Corridor (Sambra Airport & Auto Nagar)',
    description: 'Belagavi Airport (IXG), logistics parks, national highway link',
    center: [74.6180, 15.8590],
    radiusKm: 4.5,
    polygon: [
      [74.560, 15.885],
      [74.645, 15.885],
      [74.645, 15.835],
      [74.560, 15.835],
      [74.560, 15.885]
    ]
  }
];

/**
 * Determine zone from coordinates by finding nearest zone center
 */
export const identifyZoneForCoordinates = (coords) => {
  const [lng, lat] = coords;
  let nearestZone = BELAGAVI_ZONES_CONFIG[0];
  let minDistance = Infinity;

  for (const zone of BELAGAVI_ZONES_CONFIG) {
    const d = calculateHaversineDistance([lng, lat], zone.center);
    if (d < minDistance) {
      minDistance = d;
      nearestZone = zone;
    }
  }

  return nearestZone;
};

/**
 * Calculate dynamic surge multiplier and classification from demand-supply ratio
 */
export const calculateSurgeForZone = ({ activeRequests, availableDrivers, predictedDemand = 0 }) => {
  // Use blended demand (active requests + 40% of upcoming predicted demand)
  const effectiveDemand = activeRequests + Math.round(predictedDemand * 0.4);
  const supply = Math.max(1, availableDrivers);
  const ratio = Math.round((effectiveDemand / supply) * 100) / 100;

  let classification = 'BALANCED';
  let surgeMultiplier = 1.0;
  let surgeReason = 'Standard pricing: Driver supply comfortably matches current passenger demand.';

  if (ratio <= 0.75) {
    classification = 'LOW_DEMAND';
    surgeMultiplier = 1.0;
    surgeReason = 'High driver availability. Fares remain at standard baseline.';
  } else if (ratio <= 1.25) {
    classification = 'BALANCED';
    surgeMultiplier = 1.0;
    surgeReason = 'Market balanced. Standard rates apply.';
  } else if (ratio <= 2.0) {
    classification = 'HIGH_DEMAND';
    // Surge 1.2x to 1.6x
    surgeMultiplier = Math.min(1.6, Math.round((1.0 + (ratio - 1.25) * 0.8) * 10) / 10);
    surgeReason = `High demand: ${activeRequests} ride requests vs ${availableDrivers} available drivers. Fare adjusted by ${surgeMultiplier}x to incentivize nearby drivers.`;
  } else {
    classification = 'CRITICAL_SHORTAGE';
    // Surge 1.7x to 2.5x max
    surgeMultiplier = Math.min(2.5, Math.round((1.6 + Math.min(0.9, (ratio - 2.0) * 0.45)) * 10) / 10);
    surgeReason = `Critical driver shortage: Severe capacity deficit in this sector (Ratio: ${ratio}:1). Maximum dynamic pricing applied.`;
  }

  return {
    ratio,
    classification,
    surgeMultiplier,
    surgeReason,
  };
};

/**
 * Generate Proactive Driver Repositioning Recommendations
 * 
 * Pairs idle drivers in low/balanced zones with high-demand / shortage zones
 */
export const generateDriverRepositioningRecommendations = ({ zones, availableDrivers }) => {
  const recommendations = [];

  // Shortage zones (need drivers)
  const deficitZones = zones.filter(z => z.classification === 'CRITICAL_SHORTAGE' || z.classification === 'HIGH_DEMAND');

  // Surplus or balanced zones (can spare idle drivers)
  const surplusZones = zones.filter(z => z.classification === 'LOW_DEMAND' || z.classification === 'BALANCED');

  for (const targetZone of deficitZones) {
    const driversNeeded = Math.max(1, Math.ceil(targetZone.currentDemand - targetZone.availableDrivers));

    // Find idle drivers closest to this target zone who are in a surplus zone
    const candidateDrivers = availableDrivers
      .filter(d => d.isOnline && d.isAvailable && !d.activeRide)
      .map(d => {
        const coords = d.currentLocation?.coordinates || [74.5165, 15.8497];
        const distToTarget = calculateHaversineDistance(coords, targetZone.center.coordinates || targetZone.center);
        const etaMin = estimateTravelTimeMinutes(distToTarget);
        return { driver: d, distToTarget, etaMin };
      })
      .filter(item => item.distToTarget > 1.5 && item.distToTarget < 10.0) // Not already in the zone, but reasonably reachable
      .sort((a, b) => a.distToTarget - b.distToTarget)
      .slice(0, driversNeeded);

    for (const cand of candidateDrivers) {
      recommendations.push({
        id: `REPO-${cand.driver._id}-${targetZone.code}`,
        driverId: cand.driver._id,
        driverName: cand.driver.user?.name || 'Driver ' + cand.driver.licenseNumber,
        vehicleModel: cand.driver.vehicle?.model || 'Sedan',
        currentCoords: cand.driver.currentLocation?.coordinates,
        targetZoneCode: targetZone.code,
        targetZoneName: targetZone.name,
        targetCenterCoords: targetZone.center.coordinates || targetZone.center,
        distanceKm: Math.round(cand.distToTarget * 10) / 10,
        estimatedTravelMinutes: cand.etaMin,
        currentZoneClassification: cand.driver.currentZone || 'LOW_DEMAND',
        targetZoneSurge: targetZone.surgeMultiplier,
        projectedEarningsBoostPct: Math.round((targetZone.surgeMultiplier - 1.0) * 100 + 35),
        reason: `Target zone ${targetZone.name} is in ${targetZone.classification.replace('_', ' ')} (Surge ${targetZone.surgeMultiplier}x). Relocate from low-activity area to capture higher dispatch probability.`
      });
    }
  }

  return recommendations;
};
