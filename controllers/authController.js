const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpire, jwtCookieExpire } = require('../config');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const Email = require('../utils/email');

const signToken = (id, role) =>
  jwt.sign({ id, role }, jwtSecret, {
    expiresIn: jwtExpire,
  });

const getCookieOptions = (req) => {
  return {
    expires: new Date(Date.now() + jwtCookieExpire * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: (req.secure || req.headers['x-forwarded-proto'] === 'https') ? 'None' : 'Lax',
  };
};

const sendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id, user.role);
  const cookieOptions = getCookieOptions(req);
  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  const user = await User.findOne({ email, active: { $ne: false } }).select('+password');

  if (!user || !(await user.checkPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  sendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    ...getCookieOptions(req),
    expires: new Date(Date.now() + 5 * 1000),
  });
  res.status(200).json({ status: 'success' });
};

exports.isLoggedIn = async (req, res) => {
  if (req.cookies.jwt && req.cookies.jwt !== 'loggedout') {
    try {
      const decoded = await promisify(jwt.verify)(req.cookies.jwt, jwtSecret);
      const currentUser = await User.findById(decoded.id);

      if (!currentUser) {
        return res.status(200).json({ status: 'fail', data: { user: null } });
      }
      return res.status(200).json({ status: 'success', data: { user: currentUser } });
    } catch (err) {
      return res.status(200).json({ status: 'fail', data: { user: null } });
    }
  }
  res.status(200).json({ status: 'fail', data: { user: null } });
};


exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token || token === 'loggedout') {
    return next(new AppError('Please log in to get access.', 401));
  }

  const decoded = await promisify(jwt.verify)(token, jwtSecret);
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(new AppError('The user belonging to this token does no longer exist.', 401));
  }

  if (currentUser.isPasswordChangedAfter(decoded.iat)) {
    return next(new AppError('User recently changed password! Please log in again.', 401));
  }

  req.user = currentUser;
  next();
});

exports.signup = catchAsync(async (req, res, next) => {
  const user = await User.findOne({
    reg_no: req.body.reg_no.toLowerCase(),
  }).select('+active');

  if (!user) {
    throw new AppError('Details not found in the database', 404);
  }
  if (user.active) {
    throw new AppError(
      'Your profile is active. Please login using your password',
      409,
    );
  }

  const resetToken = user.generateResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    const resetURL = `${req.protocol}://${req.get(
      'host',
    )}/api/v1/users/resetPassword/`;
    await new Email(user, resetURL, resetToken).sendSignupOTP();

    res.status(200).json({
      status: 'success',
      message: 'OTP sent to email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    throw new AppError('Failed to send OTP email', 500);
  }
});


exports.restrictTo =
  (...roles) =>
    (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        throw new AppError('User not authorized to access this route.', 403);
      }
      next();
    };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({
    reg_no: req.body.reg_no.toLowerCase(),
  }).select('+active');

  if (!user) {
    throw new AppError('No user found for the given registration number', 404);
  }

  if (!user.active) {
    throw new AppError('You have not registered yet. Please Signup');
  }

  const resetToken = user.generateResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    const resetURL = `${req.protocol}://${req.get(
      'host',
    )}/api/v1/users/resetPassword/`;
    await new Email(user, resetURL, resetToken).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Reset OTP sent to email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    await user.save({ validateBeforeSave: false });
    throw new AppError('Failed to send reset email', 500);
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.body.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpiry: { $gt: Date.now() },
  }).select('+active');

  if (!user)
    return next(new AppError('User not found or token has expired', 400));

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpiry = undefined;
  if (!user.active) {
    await new Email(user).sendWelcome();
    user.active = true;
  }

  await user.save();

  sendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+password');

  const correct = await user?.checkPassword(
    req.body.passwordCurrent,
    user.password,
  );

  if (!correct) {
    throw new AppError('Incorrect password', 401);
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  sendToken(user, 200, req, res);
});