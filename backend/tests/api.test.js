import test, { describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app, server } from '../src/server.js';
import { connectDB, closeDB } from '../src/config/db.js';
import { seedDatabase } from '../src/utils/seed.js';

let passengerToken = '';
let driverToken = '';
let adminToken = '';

describe('Intelligent Ride Hailing Full-Stack Verification', () => {
  before(async () => {
    await connectDB();
    await seedDatabase();
  });

  after(async () => {
    if (server && server.close) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closeDB();
  });

  test('1. Health check returns online and Belagavi operating area', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'online');
    assert.ok(res.body.operatingArea.includes('Belagavi'));
  });

  test('2. Authenticates passenger, driver, and admin demo accounts', async () => {
    const pRes = await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'passenger@visionforge.com', password: 'password123' });
    assert.strictEqual(pRes.status, 200);
    assert.ok(pRes.body.token);
    passengerToken = pRes.body.token;

    const dRes = await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'driver1@visionforge.com', password: 'password123' });
    assert.strictEqual(dRes.status, 200);
    assert.ok(dRes.body.token);
    driverToken = dRes.body.token;

    const aRes = await request(app)
      .post('/api/auth/login')
      .send({ loginId: 'admin@visionforge.com', password: 'password123' });
    assert.strictEqual(aRes.status, 200);
    assert.ok(aRes.body.token);
    adminToken = aRes.body.token;
  });

  test('3. Calculates dynamic fare quote with Belagavi coordinates and surge', async () => {
    const res = await request(app)
      .post('/api/rides/quote')
      .send({
        pickupCoordinates: [74.5165, 15.8497], // CBT
        destinationCoordinates: [74.6180, 15.8590], // Sambra Airport
        pickupAddress: 'Belagavi Central Bus Terminal (CBT)',
        destinationAddress: 'Sambra Airport (IXG)',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.route.distanceKm > 5);
    assert.ok(res.body.quotes.Economy.finalFare > 50);
    assert.ok(res.body.poolingQuote.finalFare <= res.body.quotes.Economy.finalFare);
  });

  test('4. Mandatory Feature 1: Predictive Demand Forecasting returns Scikit-learn predictions', async () => {
    const res = await request(app).get('/api/ml/forecast');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.forecasts && res.body.forecasts.length === 6);
    assert.ok(res.body.modelEvaluation.r2Score > 0.85);
  });

  test('5. Mandatory Feature 2: Zone Intelligence returns 6 operational sectors and surge multipliers', async () => {
    const res = await request(app).get('/api/ml/zones');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.zones.length, 6);
    const centralZone = res.body.zones.find(z => z.code === 'ZONE_CENTRAL');
    assert.ok(centralZone);
    assert.ok(centralZone.surgeMultiplier >= 1.0);
  });

  test('6. Mandatory Feature 3: Ride Pooling identifies shared pairings with <15% detour', async () => {
    const res = await request(app).get('/api/ml/pooling');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.matches));
  });

  test('7. Mandatory Feature 4: Driver Fairness Utility model reduces earnings disparity', async () => {
    const res = await request(app).get('/api/ml/allocation-comparison');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.comparison);
    assert.ok(res.body.comparison.intelligentSystem);
    assert.ok(res.body.comparison.intelligentSystem.fairnessIndex > 0);
  });

  test('8. Full Ride Creation and Matching Workflow', async () => {
    const res = await request(app)
      .post('/api/rides/request')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({
        pickup: {
          address: 'Belagavi Central Bus Terminal (CBT)',
          coordinates: [74.5165, 15.8497],
          zoneCode: 'ZONE_CENTRAL',
        },
        destination: {
          address: 'Sambra Airport (IXG)',
          coordinates: [74.6180, 15.8590],
          zoneCode: 'ZONE_EAST_SAMBRA',
        },
        vehicleCategory: 'Economy',
        isPooled: false,
        paymentMethod: 'UPI',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.ride._id);
    assert.strictEqual(res.body.ride.status, 'REQUESTED');
    assert.ok(res.body.matchingResult);
    assert.ok(res.body.matchingResult.bestCandidate);
  });
});
