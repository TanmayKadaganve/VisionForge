import axios from 'axios';
import { OSRM_ROUTING_URL } from '../config/env.js';

// Belagavi Key Landmarks with verified geographic coordinates [longitude, latitude]
export const BELAGAVI_LOCATIONS = {
  CBT: {
    name: 'Belagavi Central Bus Terminal (CBT)',
    coordinates: [74.5165, 15.8497],
    zone: 'ZONE_CENTRAL',
    address: 'Central Bus Stand, Kankanwady, Belagavi, Karnataka 590001'
  },
  RAILWAY_STATION: {
    name: 'Belagavi Railway Station (BGM)',
    coordinates: [74.5020, 15.8580],
    zone: 'ZONE_CENTRAL',
    address: 'Station Road, Camp, Belagavi, Karnataka 590001'
  },
  BOGARVES: {
    name: 'Bogarves Circle / College Road',
    coordinates: [74.5120, 15.8550],
    zone: 'ZONE_CENTRAL',
    address: 'College Road, Bogarves, Belagavi, Karnataka 590001'
  },
  TILAKWADI_3RD_GATE: {
    name: 'Tilakwadi 3rd Gate',
    coordinates: [74.5074, 15.8365],
    zone: 'ZONE_TILAKWADI',
    address: 'Congress Road, Tilakwadi, Belagavi, Karnataka 590006'
  },
  RPD_CROSS: {
    name: 'RPD College Cross',
    coordinates: [74.4980, 15.8290],
    zone: 'ZONE_TILAKWADI',
    address: 'Khanapur Road, Tilakwadi, Belagavi, Karnataka 590006'
  },
  KLE_HOSPITAL: {
    name: 'KLE Prabhakar Kore Hospital & JNMC',
    coordinates: [74.5050, 15.8820],
    zone: 'ZONE_NORTH_KLE',
    address: 'Nehru Nagar, Belagavi, Karnataka 590010'
  },
  NEHRU_NAGAR: {
    name: 'Shivabasav Nagar / Nehru Nagar',
    coordinates: [74.5125, 15.8890],
    zone: 'ZONE_NORTH_KLE',
    address: 'Sector 3, Shivabasav Nagar, Belagavi, Karnataka 590010'
  },
  VTU_CAMPUS: {
    name: 'Visvesvaraya Technological University (VTU) Campus',
    coordinates: [74.4538, 15.7950],
    zone: 'ZONE_WEST_VTU',
    address: 'Jnana Sangama, Machhe, Belagavi, Karnataka 590018'
  },
  UDYAMBAG: {
    name: 'Udyambag Industrial Area',
    coordinates: [74.4950, 15.8120],
    zone: 'ZONE_SOUTH_ANGOL',
    address: 'Khanapur Road, Udyambag, Belagavi, Karnataka 590008'
  },
  SHAHAPUR: {
    name: 'Shahapur Town Market',
    coordinates: [74.5210, 15.8380],
    zone: 'ZONE_SOUTH_ANGOL',
    address: 'Khade Bazar, Shahapur, Belagavi, Karnataka 590003'
  },
  SAMBRA_AIRPORT: {
    name: 'Belagavi Airport (IXG), Sambra',
    coordinates: [74.6180, 15.8590],
    zone: 'ZONE_EAST_AIRPORT',
    address: 'Bagalkot-Belgaum Road, Sambra, Belagavi, Karnataka 591124'
  },
  AUTO_NAGAR: {
    name: 'Auto Nagar Industrial Estate',
    coordinates: [74.5450, 15.8650],
    zone: 'ZONE_EAST_AIRPORT',
    address: 'Kanbargi Road, Auto Nagar, Belagavi, Karnataka 590016'
  }
};

/**
 * Calculate Great-Circle Distance using Haversine formula
 * @param {[number, number]} coord1 [lng1, lat1]
 * @param {[number, number]} coord2 [lng2, lat2]
 * @returns {number} Distance in kilometers
 */
export const calculateHaversineDistance = (coord1, coord2) => {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Round to 2 decimal places
  return Math.round(distance * 100) / 100;
};

/**
 * Estimate road distance using urban detour factor (1.28x over straight-line)
 */
export const estimateRoadDistance = (coord1, coord2) => {
  const straight = calculateHaversineDistance(coord1, coord2);
  return Math.round(straight * 1.28 * 10) / 10;
};

/**
 * Estimate travel time in minutes based on distance and average urban speed (28 km/h)
 */
export const estimateTravelTimeMinutes = (distanceKm) => {
  const avgSpeedKmh = 28;
  const minutes = (distanceKm / avgSpeedKmh) * 60;
  return Math.max(2, Math.round(minutes));
};

/**
 * Generate interpolated route points between start and end coordinates
 */
export const generateInterpolatedRoute = (startCoord, endCoord, numPoints = 12) => {
  const [startLng, startLat] = startCoord;
  const [endLng, endLat] = endCoord;
  const points = [];

  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;
    // Add subtle realistic roadway jitter
    const jitter = i > 0 && i < numPoints ? (Math.sin(fraction * Math.PI * 3) * 0.0012) : 0;
    const lng = startLng + (endLng - startLng) * fraction + jitter;
    const lat = startLat + (endLat - startLat) * fraction + jitter * 0.5;
    points.push([Math.round(lng * 10000) / 10000, Math.round(lat * 10000) / 10000]);
  }
  return points;
};

/**
 * Fetch route from OSRM service with instant graceful fallback
 */
export const fetchRoute = async (startCoord, endCoord) => {
  const [startLng, startLat] = startCoord;
  const [endLng, endLat] = endCoord;

  try {
    const url = `${OSRM_ROUTING_URL}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const response = await axios.get(url, { timeout: 3000 });

    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
      const durationMin = Math.round(route.duration / 60);
      const coordinates = route.geometry.coordinates; // [[lng, lat], ...]

      return {
        distanceKm,
        durationMinutes: durationMin,
        coordinates,
        source: 'OSRM'
      };
    }
  } catch (err) {
    // Graceful fallback to Haversine + road factor
  }

  const distanceKm = estimateRoadDistance(startCoord, endCoord);
  const durationMinutes = estimateTravelTimeMinutes(distanceKm);
  const coordinates = generateInterpolatedRoute(startCoord, endCoord);

  return {
    distanceKm,
    durationMinutes,
    coordinates,
    source: 'HAVERSINE_ESTIMATED'
  };
};
