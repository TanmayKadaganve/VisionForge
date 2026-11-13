import { calculateHaversineDistance, estimateTravelTimeMinutes, estimateRoadDistance } from '../utils/geo.js';

/**
 * Multi-Passenger Ride Pooling & Feasible Permutation Route Optimizer
 * 
 * For 2 compatible passengers A and B, feasible waypoint sequences respecting
 * the pickup-before-dropoff constraint are:
 * 1. P_A -> P_B -> D_A -> D_B
 * 2. P_A -> P_B -> D_B -> D_A
 */
export const optimizeSharedRoute = ({ rideA, rideB }) => {
  const pA = rideA.pickup.location.coordinates;
  const dA = rideA.destination.location.coordinates;
  const pB = rideB.pickup.location.coordinates;
  const dB = rideB.destination.location.coordinates;

  // Direct unshared distances
  const directDistA = rideA.distanceKm || estimateRoadDistance(pA, dA);
  const directDistB = rideB.distanceKm || estimateRoadDistance(pB, dB);
  const unsharedSumKm = Math.round((directDistA + directDistB) * 10) / 10;

  // Feasible Sequence 1: P_A -> P_B -> D_A -> D_B
  const distSeq1 = (
    calculateHaversineDistance(pA, pB) +
    calculateHaversineDistance(pB, dA) +
    calculateHaversineDistance(dA, dB)
  ) * 1.25; // Apply urban road factor

  // Feasible Sequence 2: P_A -> P_B -> D_B -> D_A
  const distSeq2 = (
    calculateHaversineDistance(pA, pB) +
    calculateHaversineDistance(pB, dB) +
    calculateHaversineDistance(dB, dA)
  ) * 1.25;

  let bestSequence = [];
  let bestDistance = 0;
  let detourOrder = '';

  if (distSeq1 <= distSeq2) {
    bestDistance = Math.round(distSeq1 * 10) / 10;
    detourOrder = 'P_A -> P_B -> D_A -> D_B';
    bestSequence = [
      { order: 1, type: 'PICKUP', rideId: rideA._id, passengerName: rideA.passenger?.name || 'Passenger A', address: rideA.pickup.address, coordinates: pA },
      { order: 2, type: 'PICKUP', rideId: rideB._id, passengerName: rideB.passenger?.name || 'Passenger B', address: rideB.pickup.address, coordinates: pB },
      { order: 3, type: 'DROPOFF', rideId: rideA._id, passengerName: rideA.passenger?.name || 'Passenger A', address: rideA.destination.address, coordinates: dA },
      { order: 4, type: 'DROPOFF', rideId: rideB._id, passengerName: rideB.passenger?.name || 'Passenger B', address: rideB.destination.address, coordinates: dB },
    ];
  } else {
    bestDistance = Math.round(distSeq2 * 10) / 10;
    detourOrder = 'P_A -> P_B -> D_B -> D_A';
    bestSequence = [
      { order: 1, type: 'PICKUP', rideId: rideA._id, passengerName: rideA.passenger?.name || 'Passenger A', address: rideA.pickup.address, coordinates: pA },
      { order: 2, type: 'PICKUP', rideId: rideB._id, passengerName: rideB.passenger?.name || 'Passenger B', address: rideB.pickup.address, coordinates: pB },
      { order: 3, type: 'DROPOFF', rideId: rideB._id, passengerName: rideB.passenger?.name || 'Passenger B', address: rideB.destination.address, coordinates: dB },
      { order: 4, type: 'DROPOFF', rideId: rideA._id, passengerName: rideA.passenger?.name || 'Passenger A', address: rideA.destination.address, coordinates: dA },
    ];
  }

  // Calculate Detour % compared to max individual direct route
  const maxDirect = Math.max(directDistA, directDistB);
  const detourKm = Math.max(0, bestDistance - maxDirect);
  const detourPct = Math.round((detourKm / maxDirect) * 100);

  // Check compatibility criteria:
  // 1. Pickup distance between passengers <= 3.5 km
  const pickupDist = calculateHaversineDistance(pA, pB);
  const isCompatible = pickupDist <= 3.8 && detourPct <= 35 && bestDistance < unsharedSumKm;

  // Fare calculations
  const soloFareA = rideA.fare?.finalFare || Math.round(50 + directDistA * 11);
  const soloFareB = rideB.fare?.finalFare || Math.round(50 + directDistB * 11);
  const pooledFareA = Math.round(soloFareA * 0.75); // 25% discount
  const pooledFareB = Math.round(soloFareB * 0.75); // 25% discount
  const totalSavingsINR = (soloFareA - pooledFareA) + (soloFareB - pooledFareB);
  const co2EmissionsSavedKg = Math.round((unsharedSumKm - bestDistance) * 0.12 * 10) / 10;

  return {
    isCompatible,
    pickupDistanceKm: Math.round(pickupDist * 10) / 10,
    sharedDistanceKm: bestDistance,
    unsharedSumKm,
    distanceSavedKm: Math.max(0, Math.round((unsharedSumKm - bestDistance) * 10) / 10),
    totalDurationMin: estimateTravelTimeMinutes(bestDistance),
    detourPercentage: detourPct,
    optimalSequenceOrder: detourOrder,
    waypoints: bestSequence,
    fareComparison: {
      passengerA: {
        name: rideA.passenger?.name || 'Passenger A',
        soloFare: soloFareA,
        pooledFare: pooledFareA,
        savings: soloFareA - pooledFareA,
      },
      passengerB: {
        name: rideB.passenger?.name || 'Passenger B',
        soloFare: soloFareB,
        pooledFare: pooledFareB,
        savings: soloFareB - pooledFareB,
      },
      totalSavingsINR,
      co2EmissionsSavedKg,
    }
  };
};

/**
 * Scan active pending ride requests and find poolable candidate pairs
 */
export const findPoolablePairs = (pendingRides = []) => {
  const matches = [];

  for (let i = 0; i < pendingRides.length; i++) {
    for (let j = i + 1; j < pendingRides.length; j++) {
      const rideA = pendingRides[i];
      const rideB = pendingRides[j];

      // Must be same vehicle category
      if (rideA.vehicleCategory !== rideB.vehicleCategory) continue;

      const evalResult = optimizeSharedRoute({ rideA, rideB });
      if (evalResult.isCompatible) {
        matches.push({
          matchId: `POOL-${rideA._id}-${rideB._id}`,
          rideA,
          rideB,
          metrics: evalResult,
        });
      }
    }
  }

  return matches;
};
