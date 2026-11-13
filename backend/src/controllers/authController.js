import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Driver } from '../models/Driver.js';
import { Vehicle } from '../models/Vehicle.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/env.js';

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const registerPassenger = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email or phone already exists' });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: 'passenger',
      walletBalance: 1000,
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Passenger registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        rating: user.rating,
        walletBalance: user.walletBalance,
      }
    });
  } catch (err) {
    next(err);
  }
};

export const registerDriver = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      licenseNumber,
      vehicleModel,
      vehicleCategory = 'Economy',
      licensePlate,
      vehicleColor = 'White',
    } = req.body;

    if (!name || !email || !phone || !password || !licenseNumber || !vehicleModel || !licensePlate) {
      return res.status(400).json({ success: false, message: 'Please provide all driver and vehicle fields' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email or phone already exists' });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: 'driver',
    });

    const driver = await Driver.create({
      user: user._id,
      licenseNumber,
      currentLocation: {
        type: 'Point',
        coordinates: [74.5165, 15.8497], // Belagavi Central CBT
        address: 'Belagavi Central Bus Terminal (CBT)'
      },
      currentZone: 'ZONE_CENTRAL',
      isOnline: true,
      isAvailable: true,
    });

    const vehicle = await Vehicle.create({
      driver: driver._id,
      model: vehicleModel,
      category: vehicleCategory,
      licensePlate,
      color: vehicleColor,
    });

    driver.vehicle = vehicle._id;
    await driver.save();

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Driver registered and vehicle verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      driver: {
        id: driver._id,
        licenseNumber: driver.licenseNumber,
        isOnline: driver.isOnline,
        isAvailable: driver.isAvailable,
        vehicle,
      }
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { loginId, password } = req.body; // loginId can be email or phone

    if (!loginId || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email/phone and password' });
    }

    const user = await User.findOne({
      $or: [{ email: loginId.toLowerCase().trim() }, { phone: loginId.trim() }]
    }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id, user.role);

    let driverProfile = null;
    if (user.role === 'driver') {
      driverProfile = await Driver.findOne({ user: user._id }).populate('vehicle');
    }

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        rating: user.rating,
        walletBalance: user.walletBalance,
      },
      driver: driverProfile
    });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    let driverProfile = null;
    if (req.user.role === 'driver') {
      driverProfile = await Driver.findOne({ user: req.user._id }).populate('vehicle');
    }

    res.json({
      success: true,
      user: req.user,
      driver: driverProfile,
    });
  } catch (err) {
    next(err);
  }
};

export const getDemoAccounts = async (req, res, next) => {
  try {
    res.json({
      success: true,
      demoAccounts: {
        passenger: { email: 'passenger@visionforge.com', password: 'password123', role: 'passenger', name: 'Aarav Deshmukh' },
        driver: { email: 'driver1@visionforge.com', password: 'password123', role: 'driver', name: 'Ramesh Patil' },
        admin: { email: 'admin@visionforge.com', password: 'password123', role: 'admin', name: 'VisionForge Operations' },
      }
    });
  } catch (err) {
    next(err);
  }
};
