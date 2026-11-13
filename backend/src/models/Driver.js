import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
  },
  isOnline: {
    type: Boolean,
    default: true,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      default: [74.5165, 15.8497], // Belagavi Central CBT default
    },
    heading: {
      type: Number,
      default: 0,
    },
    speed: {
      type: Number,
      default: 0,
    },
    address: {
      type: String,
      default: 'Belagavi Central Bus Terminal (CBT)',
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    }
  },
  currentZone: {
    type: String,
    default: 'ZONE_CENTRAL',
  },
  acceptanceRate: {
    type: Number,
    default: 95.0,
    min: 0,
    max: 100,
  },
  totalRequestsReceived: {
    type: Number,
    default: 20,
  },
  totalRequestsAccepted: {
    type: Number,
    default: 19,
  },
  totalCompletedRides: {
    type: Number,
    default: 18,
  },
  todayRidesCount: {
    type: Number,
    default: 2,
  },
  totalEarnings: {
    type: Number,
    default: 1450.0,
  },
  rating: {
    type: Number,
    default: 4.85,
    min: 1,
    max: 5,
  },
  lastAssignedAt: {
    type: Date,
    default: () => new Date(Date.now() - 45 * 60 * 1000), // 45 min ago idle
  },
  activeRide: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    default: null,
  }
}, {
  timestamps: true,
});

driverSchema.index({ currentLocation: '2dsphere' });

export const Driver = mongoose.model('Driver', driverSchema);
