import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false,
  },
  role: {
    type: String,
    enum: ['passenger', 'driver', 'admin'],
    default: 'passenger',
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'pending'],
    default: 'active',
  },
  rating: {
    type: Number,
    default: 4.8,
    min: 1,
    max: 5,
  },
  totalRides: {
    type: Number,
    default: 0,
  },
  walletBalance: {
    type: Number,
    default: 500, // INR simulated credit for test rides
  },
  avatar: {
    type: String,
    default: '',
  }
}, {
  timestamps: true,
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model('User', userSchema);
