import mongoose from 'mongoose';

const poolingGroupSchema = new mongoose.Schema({
  groupCode: {
    type: String,
    unique: true,
  },
  status: {
    type: String,
    enum: ['MATCHED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED'],
    default: 'MATCHED',
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true,
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
  },
  rides: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
  }],
  passengers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  waypoints: [{
    order: Number,
    type: {
      type: String,
      enum: ['PICKUP', 'DROPOFF'],
    },
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
    },
    passengerName: String,
    address: String,
    coordinates: [Number], // [lng, lat]
    completed: {
      type: Boolean,
      default: false,
    },
    estimatedArrivalMin: Number,
  }],
  totalDistanceKm: {
    type: Number,
    required: true,
  },
  totalDurationMin: {
    type: Number,
    required: true,
  },
  unsharedDistanceSumKm: {
    type: Number,
    required: true,
  },
  sharedRouteCoordinates: {
    type: [[Number]],
    default: [],
  },
  totalSavingsINR: {
    type: Number,
    default: 0,
  },
  detourPercentage: {
    type: Number,
    default: 0,
  }
}, {
  timestamps: true,
});

poolingGroupSchema.pre('save', function (next) {
  if (!this.groupCode) {
    this.groupCode = 'POOL-' + Math.random().toString(36).substring(2, 7).toUpperCase();
  }
  next();
});

export const PoolingGroup = mongoose.model('PoolingGroup', poolingGroupSchema);
