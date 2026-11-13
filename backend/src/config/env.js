import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 5000;
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/visionforge_ride';
export const JWT_SECRET = process.env.JWT_SECRET || 'visionforge_ride_jwt_secret_belagavi_2026';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
export const OSRM_ROUTING_URL = process.env.OSRM_ROUTING_URL || 'https://router.project-osrm.org';
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
