import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  ride: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true,
  },
  passenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  method: {
    type: String,
    enum: ['WALLET', 'CARD', 'UPI', 'CASH'],
    default: 'UPI',
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'],
    default: 'SUCCESS',
  },
  transactionId: {
    type: String,
    unique: true,
  },
  breakdown: {
    baseFare: Number,
    distanceCharge: Number,
    timeCharge: Number,
    surgeAmount: Number,
    poolingDiscount: Number,
    platformFee: Number,
    driverEarnings: Number,
  }
}, {
  timestamps: true,
});

paymentSchema.pre('save', function (next) {
  if (!this.transactionId) {
    this.transactionId = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  next();
});

export const Payment = mongoose.model('Payment', paymentSchema);
