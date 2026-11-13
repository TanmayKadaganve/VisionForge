import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true,
  },
  model: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: ['Economy', 'Premium', 'XL'],
    default: 'Economy',
  },
  licensePlate: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  color: {
    type: String,
    default: 'White',
  },
  capacity: {
    type: Number,
    default: 4,
  },
  year: {
    type: Number,
    default: 2023,
  }
}, {
  timestamps: true,
});

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
