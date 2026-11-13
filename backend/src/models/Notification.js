import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['RIDE_REQUEST', 'RIDE_ACCEPTED', 'DRIVER_ARRIVING', 'RIDE_STARTED', 'RIDE_COMPLETED', 'DRIVER_REASSIGNED', 'SURGE_ALERT', 'GENERAL'],
    default: 'GENERAL',
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  read: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true,
});

notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
