const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter your name'],
    trim: true,
    minlength: [3, 'Name must be of more than 3 characters'],
    maxlength: [30, 'Name must be of less than 30 characters'],
  },
  reg_no: {
    type: String,
    required: [true, 'User must have a registration number'],
    unique: [true, 'Profile created for this user'],
    trim: true,
  },
  batch: {
    type: Number,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'verifier', 'admin'],
    default: 'user',
  },
  email: {
    type: String,
    required: [true, 'A User must have an email.'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Please enter a password'],
    minlength: [8, 'Password must be longer than 8 characters'],
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      validator: function (el) {
        return this.password === el;
      },
      message: 'Passwords do not match',
    },
  },
  active: {
    type: Boolean,
    default: false,
    select: false,
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpiry: Date,
});

userSchema.pre('save', async function (next) {
  //Check if password is modified or not
  if (!this.isModified('password')) return next();

  //Hashing the password
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;

  if (!this.isNew) this.passwordChangedAt = Date.now() - 1000;
  return next();
});

// userSchema.pre(/\bfind\w*/, function (next) {
//   this.find({ active: { $ne: false } });
//   next();
// });

userSchema.methods.checkPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.isPasswordChangedAfter = function (TokenTime) {
  if (this.passwordChangedAt) {
    const changeTime = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return TokenTime < changeTime;
  }

  return false;
};

userSchema.methods.generateResetToken = function () {
  //generate token
  const token = crypto.randomBytes(3).toString('hex').toUpperCase();

  //encrypt the token
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  //set reset expiry
  this.passwordResetExpiry = Date.now() + 10 * 60 * 1000;

  //return token
  return token;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
