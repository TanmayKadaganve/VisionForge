import mongoose from 'mongoose';

const driverLocationSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
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
  heading: {
    type: Number,
    default: 0,
  },
  speed: {
    type: Number,
    default: 0,
  },
  activeRide: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true,
});

driverLocationSchema.index({ location: '2dsphere' });
driverLocationSchema.index({ driver: 1, timestamp: -1 });

export const DriverLocation = mongoose.model('DriverLocation', driverLocationSchema);
