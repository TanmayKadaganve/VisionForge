import mongoose from 'mongoose';
import { MONGODB_URI } from './env.js';

let mongodInstance = null;

export const connectDB = async () => {
  try {
    // Attempt connecting to the configured URI with a 2-second timeout
    console.log(`[DB] Attempting connection to MongoDB at: ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log('[DB] Connected to MongoDB daemon successfully.');
  } catch (err) {
    console.warn('[DB] Standard MongoDB daemon not available on localhost. Falling back to embedded MongoMemoryServer...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create({
        instance: {
          dbName: 'visionforge_ride'
        }
      });
      const uri = mongodInstance.getUri();
      await mongoose.connect(uri);
      console.log(`[DB] Embedded MongoMemoryServer connected successfully at: ${uri}`);
    } catch (innerErr) {
      console.error('[DB] Failed to initialize embedded MongoDB:', innerErr);
      throw innerErr;
    }
  }
};

export const closeDB = async () => {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
};
