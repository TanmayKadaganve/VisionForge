import { User } from '../models/User.js';
import { Ride } from '../models/Ride.js';

export const getPassengerProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const completedRides = await Ride.countDocuments({ passenger: user._id, status: 'COMPLETED' });
    const totalSpent = await Ride.aggregate([
      { $match: { passenger: user._id, status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$fare.finalFare' } } }
    ]);

    res.json({
      success: true,
      profile: user,
      stats: {
        completedRides,
        totalSpentINR: totalSpent[0]?.total || 0,
      }
    });
  } catch (err) {
    next(err);
  }
};

export const updatePassengerProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, avatar },
      { new: true, runValidators: true }
    );
    res.json({ success: true, message: 'Profile updated', profile: user });
  } catch (err) {
    next(err);
  }
};

export const getPassengerRideHistory = async (req, res, next) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    const query = { passenger: req.user._id };

    if (status && status !== 'ALL') {
      query.status = status;
    }

    const rides = await Ride.find(query)
      .populate({
        path: 'driver',
        populate: [{ path: 'user', select: 'name phone avatar' }, { path: 'vehicle' }]
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Ride.countDocuments(query);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      rides,
    });
  } catch (err) {
    next(err);
  }
};

export const topUpWallet = async (req, res, next) => {
  try {
    const { amount = 500 } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { walletBalance: amount } },
      { new: true }
    );
    res.json({ success: true, message: `Added ₹${amount} to wallet`, balance: user.walletBalance });
  } catch (err) {
    next(err);
  }
};
