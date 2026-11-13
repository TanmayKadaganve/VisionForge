import mongoose from 'mongoose';

const demandForecastSchema = new mongoose.Schema({
  zoneCode: {
    type: String,
    required: true,
  },
  zoneName: {
    type: String,
    required: true,
  },
  targetDate: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  targetHour: {
    type: Number, // 0 - 23
    required: true,
  },
  predictedDemand: {
    type: Number,
    required: true,
  },
  actualDemand: {
    type: Number,
    default: null,
  },
  driverSupply: {
    type: Number,
    default: 0,
  },
  expectedDeficit: {
    type: Number,
    default: 0,
  },
  recommendedDispatchCount: {
    type: Number,
    default: 0,
  },
  recommendedSourceZone: {
    type: String,
    default: null,
  },
  modelConfidence: {
    type: Number,
    default: 0.91,
  },
  algorithmUsed: {
    type: String,
    default: 'GradientBoostingRegressor (scikit-learn)',
  },
  features: {
    hour: Number,
    dayOfWeek: Number,
    isWeekend: Boolean,
    historicalAvg: Number,
  }
}, {
  timestamps: true,
});

demandForecastSchema.index({ zoneCode: 1, targetHour: 1 });

export const DemandForecast = mongoose.model('DemandForecast', demandForecastSchema);
