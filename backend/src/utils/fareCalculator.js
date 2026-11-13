export const VEHICLE_RATES = {
  Economy: {
    baseFare: 45.0,
    perKmRate: 11.0,
    perMinuteRate: 1.5,
    minFare: 60.0,
    surgeCapacity: 4,
    description: 'Affordable, compact rides for daily commute'
  },
  Premium: {
    baseFare: 75.0,
    perKmRate: 16.5,
    perMinuteRate: 2.5,
    minFare: 110.0,
    surgeCapacity: 4,
    description: 'Top-rated drivers in premium sedans'
  },
  XL: {
    baseFare: 110.0,
    perKmRate: 22.0,
    perMinuteRate: 3.5,
    minFare: 150.0,
    surgeCapacity: 6,
    description: 'Spacious SUVs with extra legroom & luggage space'
  }
};

/**
 * Calculate fare breakdown with full itemized transparency
 */
export const calculateFare = ({
  distanceKm,
  durationMinutes,
  category = 'Economy',
  surgeMultiplier = 1.0,
  surgeReason = 'Standard Pricing',
  isPooled = false,
}) => {
  const rates = VEHICLE_RATES[category] || VEHICLE_RATES.Economy;

  const baseFare = rates.baseFare;
  const distanceCharge = Math.round(distanceKm * rates.perKmRate * 10) / 10;
  const timeCharge = Math.round(durationMinutes * rates.perMinuteRate * 10) / 10;

  const subtotal = baseFare + distanceCharge + timeCharge;
  const surgeAmount = Math.round(subtotal * (surgeMultiplier - 1.0) * 10) / 10;
  const surchargedTotal = subtotal + surgeAmount;

  // Multi-passenger ride pooling discount: 25% discount off total
  const poolingDiscount = isPooled ? Math.round(surchargedTotal * 0.25 * 10) / 10 : 0;

  const finalCalculated = Math.max(rates.minFare, Math.round(surchargedTotal - poolingDiscount));

  return {
    category,
    baseFare,
    distanceKm,
    durationMinutes,
    distanceCharge,
    timeCharge,
    subtotal: Math.round(subtotal),
    surgeMultiplier: Number(surgeMultiplier.toFixed(2)),
    surgeAmount,
    surgeReason,
    isPooled,
    poolingDiscount,
    finalFare: finalCalculated,
    currency: 'INR'
  };
};
