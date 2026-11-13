import mongoose from 'mongoose';

const zoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    default: '',
  },
  center: {
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
  polygon: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon',
    },
    coordinates: {
      type: [[[Number]]], // Array of linear rings of [lng, lat]
      required: true,
    }
  },
  radiusKm: {
    type: Number,
    default: 3.5,
  },
  currentDemand: {
    type: Number,
    default: 8,
  },
  availableDrivers: {
    type: Number,
    default: 6,
  },
  predictedDemandNextHour: {
    type: Number,
    default: 12,
  },
  demandSupplyRatio: {
    type: Number,
    default: 1.33,
  },
  classification: {
    type: String,
    enum: ['LOW_DEMAND', 'BALANCED', 'HIGH_DEMAND', 'CRITICAL_SHORTAGE'],
    default: 'BALANCED',
  },
  surgeMultiplier: {
    type: Number,
    default: 1.0,
    min: 1.0,
    max: 3.0,
  },
  surgeReason: {
    type: String,
    default: 'Standard market rates apply. Driver supply meets current request volume.',
  },
  avgPickupEtaMin: {
    type: Number,
    default: 4.5,
  },
  baseFareOffset: {
    type: Number,
    default: 0,
  }
}, {
  timestamps: true,
});

zoneSchema.index({ center: '2dsphere' });
zoneSchema.index({ polygon: '2dsphere' });

export const Zone = mongoose.model('Zone', zoneSchema);
