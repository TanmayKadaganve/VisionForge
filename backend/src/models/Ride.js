import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema({
  rideCode: {
    type: String,
    unique: true,
  },
  passenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null,
  },
  vehicleCategory: {
    type: String,
    enum: ['Economy', 'Premium', 'XL'],
    default: 'Economy',
  },
  status: {
    type: String,
    enum: ['REQUESTED', 'ACCEPTED', 'ARRIVING', 'ONGOING', 'COMPLETED', 'CANCELLED'],
    default: 'REQUESTED',
  },
  pickup: {
    address: {
      type: String,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      }
    },
    zoneCode: {
      type: String,
      default: 'ZONE_CENTRAL',
    }
  },
  destination: {
    address: {
      type: String,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      }
    },
    zoneCode: {
      type: String,
      default: 'ZONE_TILAKWADI',
    }
  },
  distanceKm: {
    type: Number,
    required: true,
    default: 4.5,
  },
  durationMinutes: {
    type: Number,
    required: true,
    default: 12,
  },
  pickupEtaMinutes: {
    type: Number,
    default: 5,
  },
  fare: {
    baseFare: { type: Number, default: 50 },
    distanceCharge: { type: Number, default: 45 },
    timeCharge: { type: Number, default: 12 },
    surgeMultiplier: { type: Number, default: 1.0 },
    surgeReason: { type: String, default: 'Standard pricing' },
    poolingDiscount: { type: Number, default: 0 },
    finalFare: { type: Number, required: true, default: 107 },
    currency: { type: String, default: 'INR' },
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'REFUNDED'],
    default: 'PENDING',
  },
  paymentMethod: {
    type: String,
    enum: ['WALLET', 'CARD', 'UPI', 'CASH'],
    default: 'UPI',
  },
  routeCoordinates: {
    type: [[Number]], // Array of [lng, lat]
    default: [],
  },
  currentDriverLocation: {
    type: [Number], // [lng, lat]
    default: null,
  },
  allocationFairness: {
    selectedDriverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
    fairnessScore: { type: Number, default: 0 },
    factorScores: {
      etaScore: { type: Number, default: 0 },
      distanceScore: { type: Number, default: 0 },
      workloadScore: { type: Number, default: 0 },
      acceptanceScore: { type: Number, default: 0 },
      idleScore: { type: Number, default: 0 },
    },
    selectionExplanation: { type: String, default: '' },
    candidateRank: { type: Number, default: 1 },
    totalCandidatesEvaluated: { type: Number, default: 0 },
  },
  reassignmentAttempts: {
    type: Number,
    default: 0,
  },
  excludedDriverIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
  }],
  reassignmentHistory: [{
    attempt: Number,
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
    driverName: String,
    reason: String, // 'REJECTED' | 'TIMEOUT' | 'CANCELLED'
    timestamp: { type: Date, default: Date.now },
  }],
  isPooled: {
    type: Boolean,
    default: false,
  },
  poolingGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PoolingGroup',
    default: null,
  },
  cancelledBy: {
    type: String,
    enum: ['PASSENGER', 'DRIVER', 'SYSTEM', null],
    default: null,
  },
  cancelReason: {
    type: String,
    default: '',
  },
  ratingByPassenger: {
    score: { type: Number, min: 1, max: 5 },
    comment: String,
  },
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
}, {
  timestamps: true,
});

rideSchema.index({ 'pickup.location': '2dsphere' });
rideSchema.index({ 'destination.location': '2dsphere' });

// Auto-generate human-friendly rideCode before saving
rideSchema.pre('save', function (next) {
  if (!this.rideCode) {
    this.rideCode = 'VF-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

export const Ride = mongoose.model('Ride', rideSchema);
