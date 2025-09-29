require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set in .env');
  process.exit(1);
}

const identifier = process.argv[2];
if (!identifier) {
  console.error('Usage: node scripts/makeAdmin.js <user-email-or-username>');
  process.exit(1);
}

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');
    // Try email then username
    let user = await User.findOne({ email: identifier });
    if (!user) user = await User.findOne({ username: identifier });
    if (!user) {
      console.error('User not found');
      process.exit(1);
    }
    user.role = 'admin';
    await user.save();
    console.log(`User ${user.username || user.email} promoted to admin`);
    process.exit(0);
  })
  .catch(err => {
    console.error('DB error', err);
    process.exit(1);
  });