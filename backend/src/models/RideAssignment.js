import mongoose from 'mongoose';

const rideAssignmentSchema = new mongoose.Schema({
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true,
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true,
  },
  attemptNumber: {
    type: Number,
    required: true,
    default: 1,
  },
  status: {
    type: String,
    enum: ['OFFERED', 'ACCEPTED', 'REJECTED', 'TIMEOUT', 'CANCELLED'],
    default: 'OFFERED',
  },
  fairnessScore: {
    type: Number,
    default: 0,
  },
  metrics: {
    distanceKm: Number,
    etaMinutes: Number,
    workloadToday: Number,
    idleMinutes: Number,
    acceptanceRate: Number,
  },
  offeredAt: {
    type: Date,
    default: Date.now,
  },
  timeoutAt: {
    type: Date,
    default: () => new Date(Date.now() + 15 * 1000), // 15s driver response window
  },
  respondedAt: {
    type: Date,
  },
  notes: {
    type: String,
    default: '',
  }
}, {
  timestamps: true,
});

export const RideAssignment = mongoose.model('RideAssignment', rideAssignmentSchema);
