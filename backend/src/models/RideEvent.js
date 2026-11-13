import mongoose from 'mongoose';

const rideEventSchema = new mongoose.Schema({
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true,
  },
  eventType: {
    type: String,
    enum: [
      'REQUESTED',
      'MATCH_ATTEMPT',
      'OFFERED_TO_DRIVER',
      'ACCEPTED',
      'REJECTED',
      'TIMEOUT',
      'REASSIGNED',
      'DRIVER_ARRIVING',
      'TRIP_STARTED',
      'LOCATION_PING',
      'TRIP_COMPLETED',
      'CANCELLED'
    ],
    required: true,
  },
  actorRole: {
    type: String,
    enum: ['PASSENGER', 'DRIVER', 'SYSTEM', 'ADMIN'],
    default: 'SYSTEM',
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true,
});

rideEventSchema.index({ ride: 1, timestamp: 1 });

export const RideEvent = mongoose.model('RideEvent', rideEventSchema);
