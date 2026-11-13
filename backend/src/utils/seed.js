import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Driver } from '../models/Driver.js';
import { Vehicle } from '../models/Vehicle.js';
import { Ride } from '../models/Ride.js';
import { Zone } from '../models/Zone.js';
import { DemandForecast } from '../models/DemandForecast.js';
import { RideAssignment } from '../models/RideAssignment.js';
import { RideEvent } from '../models/RideEvent.js';
import { BELAGAVI_ZONES_CONFIG } from '../algorithms/zoneEngine.js';
import { BELAGAVI_LOCATIONS } from './geo.js';

export const seedDatabase = async () => {
  try {
    console.log('[Seed] Checking if database needs initial seeding...');

    // If admin exists, we already seeded
    const existingAdmin = await User.findOne({ email: 'admin@visionforge.com' });
    if (existingAdmin) {
      console.log('[Seed] Database is already initialized. Skipping duplicate seeding.');
      return;
    }

    console.log('[Seed] Initializing seed data for Belagavi operating area...');

    // 1. Seed Zones
    for (const z of BELAGAVI_ZONES_CONFIG) {
      await Zone.create({
        name: z.name,
        code: z.code,
        description: z.description,
        center: { type: 'Point', coordinates: z.center },
        polygon: { type: 'Polygon', coordinates: [z.polygon] },
        radiusKm: z.radiusKm,
        currentDemand: z.code === 'ZONE_CENTRAL' ? 14 : (z.code === 'ZONE_TILAKWADI' ? 9 : 6),
        availableDrivers: z.code === 'ZONE_CENTRAL' ? 5 : (z.code === 'ZONE_TILAKWADI' ? 6 : 4),
        predictedDemandNextHour: z.code === 'ZONE_CENTRAL' ? 18 : (z.code === 'ZONE_TILAKWADI' ? 12 : 8),
        surgeMultiplier: z.code === 'ZONE_CENTRAL' ? 1.5 : 1.0,
        surgeReason: z.code === 'ZONE_CENTRAL'
          ? 'High evening market demand in Central Belagavi. Surge 1.5x.'
          : 'Standard pricing. Driver supply meets current request volume.',
        classification: z.code === 'ZONE_CENTRAL' ? 'HIGH_DEMAND' : 'BALANCED',
      });
    }
    console.log('[Seed] Operational zones created.');

    // 2. Create Admin User
    const adminUser = await User.create({
      name: 'VisionForge Operations Admin',
      email: 'admin@visionforge.com',
      phone: '+91 98800 12340',
      password: 'password123',
      role: 'admin',
    });

    // 3. Create Passengers
    const passenger1 = await User.create({
      name: 'Aarav Deshmukh',
      email: 'passenger@visionforge.com',
      phone: '+91 98450 11111',
      password: 'password123',
      role: 'passenger',
      rating: 4.9,
      totalRides: 14,
      walletBalance: 1250,
    });

    const passenger2 = await User.create({
      name: 'Priya Sharma',
      email: 'priya@visionforge.com',
      phone: '+91 98450 22222',
      password: 'password123',
      role: 'passenger',
      rating: 4.85,
      totalRides: 8,
      walletBalance: 850,
    });

    const passenger3 = await User.create({
      name: 'Rohan Kulkarni',
      email: 'rohan@visionforge.com',
      phone: '+91 98450 33333',
      password: 'password123',
      role: 'passenger',
      rating: 4.75,
      totalRides: 19,
      walletBalance: 600,
    });
    console.log('[Seed] Passengers created.');

    // 4. Create Drivers & Vehicles across Belagavi
    const driverConfigs = [
      {
        name: 'Ramesh Patil',
        email: 'driver1@visionforge.com',
        phone: '+91 99001 10001',
        license: 'KA-22-2018-009812',
        model: 'Maruti Suzuki Dzire',
        category: 'Economy',
        plate: 'KA-22-B-4412',
        color: 'Silver',
        coords: [74.5140, 15.8520], // Near Bogarves Circle
        zone: 'ZONE_CENTRAL',
        rating: 4.88,
        todayRides: 2,
        acceptanceRate: 96,
        idleMin: 35,
      },
      {
        name: 'Suresh Hegde',
        email: 'driver2@visionforge.com',
        phone: '+91 99001 10002',
        license: 'KA-22-2019-004521',
        model: 'Toyota Etios',
        category: 'Economy',
        plate: 'KA-22-A-8723',
        color: 'White',
        coords: [74.5090, 15.8390], // Tilakwadi 1st Gate
        zone: 'ZONE_TILAKWADI',
        rating: 4.82,
        todayRides: 4,
        acceptanceRate: 92,
        idleMin: 15,
      },
      {
        name: 'Ganesh Naik',
        email: 'driver3@visionforge.com',
        phone: '+91 99001 10003',
        license: 'KA-22-2020-007134',
        model: 'Honda City',
        category: 'Premium',
        plate: 'KA-22-M-1988',
        color: 'Pearl White',
        coords: [74.5040, 15.8800], // Near KLE Hospital
        zone: 'ZONE_NORTH_KLE',
        rating: 4.94,
        todayRides: 1,
        acceptanceRate: 98,
        idleMin: 55,
      },
      {
        name: 'Anand Joshi',
        email: 'driver4@visionforge.com',
        phone: '+91 99001 10004',
        license: 'KA-22-2017-003299',
        model: 'Toyota Innova Crysta',
        category: 'XL',
        plate: 'KA-22-N-7766',
        color: 'Garnet Red',
        coords: [74.5180, 15.8480], // Belagavi Central CBT
        zone: 'ZONE_CENTRAL',
        rating: 4.91,
        todayRides: 3,
        acceptanceRate: 94,
        idleMin: 22,
      },
      {
        name: 'Vikram Deshpande',
        email: 'driver5@visionforge.com',
        phone: '+91 99001 10005',
        license: 'KA-22-2021-001923',
        model: 'Hyundai Aura',
        category: 'Economy',
        plate: 'KA-22-C-3301',
        color: 'Grey',
        coords: [74.4990, 15.8260], // Near RPD Cross / Angol
        zone: 'ZONE_SOUTH_ANGOL',
        rating: 4.79,
        todayRides: 5,
        acceptanceRate: 89,
        idleMin: 10,
      },
      {
        name: 'Pradeep Kamat',
        email: 'driver6@visionforge.com',
        phone: '+91 99001 10006',
        license: 'KA-22-2022-005810',
        model: 'Maruti Ertiga',
        category: 'XL',
        plate: 'KA-22-D-9102',
        color: 'White',
        coords: [74.6100, 15.8610], // Near Sambra Airport link
        zone: 'ZONE_EAST_AIRPORT',
        rating: 4.86,
        todayRides: 1,
        acceptanceRate: 95,
        idleMin: 65,
      }
    ];

    const seededDrivers = [];
    for (const dCfg of driverConfigs) {
      const u = await User.create({
        name: dCfg.name,
        email: dCfg.email,
        phone: dCfg.phone,
        password: 'password123',
        role: 'driver',
        rating: dCfg.rating,
      });

      const d = await Driver.create({
        user: u._id,
        licenseNumber: dCfg.license,
        isOnline: true,
        isAvailable: true,
        currentLocation: {
          type: 'Point',
          coordinates: dCfg.coords,
          heading: Math.floor(Math.random() * 360),
          address: `${dCfg.zone.replace('ZONE_', '').replace('_', ' ')} Hub, Belagavi`,
        },
        currentZone: dCfg.zone,
        rating: dCfg.rating,
        todayRidesCount: dCfg.todayRides,
        acceptanceRate: dCfg.acceptanceRate,
        totalCompletedRides: dCfg.todayRides + 24,
        totalEarnings: (dCfg.todayRides + 24) * 115,
        lastAssignedAt: new Date(Date.now() - dCfg.idleMin * 60 * 1000),
      });

      const v = await Vehicle.create({
        driver: d._id,
        model: dCfg.model,
        category: dCfg.category,
        licensePlate: dCfg.plate,
        color: dCfg.color,
      });

      d.vehicle = v._id;
      await d.save();
      seededDrivers.push(d);
    }
    console.log(`[Seed] ${seededDrivers.length} verified drivers and vehicles created.`);

    // 5. Create Sample Historical & Active Rides in Belagavi
    const sampleCompletedRide = await Ride.create({
      rideCode: 'VF-BEL001',
      passenger: passenger1._id,
      driver: seededDrivers[0]._id,
      vehicleCategory: 'Economy',
      status: 'COMPLETED',
      pickup: {
        address: BELAGAVI_LOCATIONS.CBT.address,
        location: { type: 'Point', coordinates: BELAGAVI_LOCATIONS.CBT.coordinates },
        zoneCode: 'ZONE_CENTRAL'
      },
      destination: {
        address: BELAGAVI_LOCATIONS.TILAKWADI_3RD_GATE.address,
        location: { type: 'Point', coordinates: BELAGAVI_LOCATIONS.TILAKWADI_3RD_GATE.coordinates },
        zoneCode: 'ZONE_TILAKWADI'
      },
      distanceKm: 3.8,
      durationMinutes: 11,
      pickupEtaMinutes: 4,
      fare: {
        baseFare: 45,
        distanceCharge: 41.8,
        timeCharge: 16.5,
        surgeMultiplier: 1.0,
        surgeReason: 'Standard pricing',
        poolingDiscount: 0,
        finalFare: 103,
        currency: 'INR'
      },
      paymentStatus: 'PAID',
      paymentMethod: 'UPI',
      ratingByPassenger: { score: 5, comment: 'Punctual and very smooth driving on Congress Road!' },
      startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2.8 * 60 * 60 * 1000),
    });

    const sampleAirportRide = await Ride.create({
      rideCode: 'VF-BEL002',
      passenger: passenger2._id,
      driver: seededDrivers[2]._id,
      vehicleCategory: 'Premium',
      status: 'COMPLETED',
      pickup: {
        address: BELAGAVI_LOCATIONS.KLE_HOSPITAL.address,
        location: { type: 'Point', coordinates: BELAGAVI_LOCATIONS.KLE_HOSPITAL.coordinates },
        zoneCode: 'ZONE_NORTH_KLE'
      },
      destination: {
        address: BELAGAVI_LOCATIONS.SAMBRA_AIRPORT.address,
        location: { type: 'Point', coordinates: BELAGAVI_LOCATIONS.SAMBRA_AIRPORT.coordinates },
        zoneCode: 'ZONE_EAST_AIRPORT'
      },
      distanceKm: 13.4,
      durationMinutes: 26,
      pickupEtaMinutes: 5,
      fare: {
        baseFare: 75,
        distanceCharge: 221.1,
        timeCharge: 65,
        surgeMultiplier: 1.2,
        surgeReason: 'Airport corridor peak travel',
        poolingDiscount: 0,
        finalFare: 433,
        currency: 'INR'
      },
      paymentStatus: 'PAID',
      paymentMethod: 'CARD',
      ratingByPassenger: { score: 5, comment: 'Clean Honda City, reached airport right on time!' },
      startedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000),
    });

    // 6. Create one pending ride to demonstrate instant driver matching and ride pooling
    const pendingRide = await Ride.create({
      rideCode: 'VF-BEL777',
      passenger: passenger3._id,
      vehicleCategory: 'Economy',
      status: 'REQUESTED',
      pickup: {
        address: BELAGAVI_LOCATIONS.RAILWAY_STATION.address,
        location: { type: 'Point', coordinates: BELAGAVI_LOCATIONS.RAILWAY_STATION.coordinates },
        zoneCode: 'ZONE_CENTRAL'
      },
      destination: {
        address: BELAGAVI_LOCATIONS.RPD_CROSS.address,
        location: { type: 'Point', coordinates: BELAGAVI_LOCATIONS.RPD_CROSS.coordinates },
        zoneCode: 'ZONE_TILAKWADI'
      },
      distanceKm: 4.2,
      durationMinutes: 13,
      pickupEtaMinutes: 5,
      fare: {
        baseFare: 45,
        distanceCharge: 46.2,
        timeCharge: 19.5,
        surgeMultiplier: 1.2,
        surgeReason: 'High demand near station',
        poolingDiscount: 0,
        finalFare: 133,
        currency: 'INR'
      },
      paymentStatus: 'PENDING',
      paymentMethod: 'UPI',
    });

    console.log('[Seed] Sample rides and demonstration scenario initialized successfully.');
  } catch (err) {
    console.error('[Seed] Error seeding database:', err.message);
  }
};
