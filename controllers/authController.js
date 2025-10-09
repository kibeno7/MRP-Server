const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpire, jwtCookieExpire } = require('../config');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const Email = require('../utils/email');

// Reusable function to sign a token
const signToken = (id, role) => jwt.sign({ id, role }, jwtSecret, { expiresIn: jwtExpire });

// Centralized cookie options
const getCookieOptions = (req) => {
  return {
    expires: new Date(Date.now() + jwtCookieExpire * 24 * 60 * 60 * 1000),
    httpOnly: true,
    // The 'secure' flag is crucial. It should be true in production (HTTPS)
    // and is determined by checking the request's protocol.
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: 'None',
  };
};

// Reusable function to send the token in a cookie and as a JSON response
const sendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id, user.role);
  const cookieOptions = getCookieOptions(req);

  res.cookie('jwt', token, cookieOptions);

  // Remove password from the output for security
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

// User Login
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

// User Logout
exports.logout = (req, res) => {
  // To clear the cookie, we send a cookie with the same name but with an immediate expiration date.
  const cookieOptions = getCookieOptions(req);
  res.cookie('jwt', 'loggedout', {
    ...cookieOptions,
    expires: new Date(Date.now() + 5 * 1000), // Expires in 5 seconds
  });
  res.status(200).json({ status: 'success' });
};

// Middleware to protect routes
exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token || token === 'loggedout') {
    return next(new AppError('Please log in to get access.', 401));
  }

  // 1) Verify token
  const decoded = await promisify(jwt.verify)(token, jwtSecret);

  // 2) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token does no longer exist.', 401));
  }

  // 3) Check if user changed password after the token was issued
  if (currentUser.isPasswordChangedAfter(decoded.iat)) {
    return next(new AppError('User recently changed password! Please log in again.', 401));
  }

  // Grant access
  req.user = currentUser;
  next();
});

exports.isLoggedIn = catchAsync(async (req, res, next) => {
  console.log('Method invoked');
  console.log(req.cookies.jwt);
    if (req.cookies.jwt && req.cookies.jwt !== 'loggedout') {
        const decoded = await promisify(jwt.verify)(req.cookies.jwt, jwtSecret);
        const currentUser = await User.findById(decoded.id);
        if (!currentUser || !currentUser.active) {
            return res.status(200).json({ status: 'fail', data: { user: null } });
        }

        if (currentUser.isPasswordChangedAfter(decoded.iat)) {
            return res.status(200).json({ status: 'fail', data: { user: null } });
        }
        return res.status(200).json({
            status: 'success',
            data: {
                user: currentUser,
            },
        });
    }

    // No token found
    res.status(200).json({ status: 'fail', data: { user: null } });
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

  //send token to user email
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
  //find user id
  const user = await User.findOne({
    reg_no: req.body.reg_no.toLowerCase(),
  }).select('+active');

  if (!user) {
    throw new AppError('No user found for the given registration number', 404);
  }

  if (!user.active) {
    throw new AppError('You have not registered yet. Please Signup');
  }

  //generate reset token and store it in db
  const resetToken = user.generateResetToken();
  await user.save({ validateBeforeSave: false });

  //send token to user email
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
  //Get user from token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.body.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpiry: { $gt: Date.now() },
  }).select('+active');

  //Check if token has expired or user doen not exist
  if (!user)
    return next(new AppError('User not found or token has expired', 400));

  //Change the password

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpiry = undefined;
  if (!user.active) {
    await new Email(user).sendWelcome();
    user.active = true;
  }

  await user.save();

  //Login user
  sendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // get user
  const user = await User.findById(req.user._id).select('+password');

  //3. Check if password match
  const correct = await user?.checkPassword(
    req.body.passwordCurrent,
    user.password,
  );

  if (!correct) {
    throw new AppError('Incorrect password', 401);
  }

  // update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // send new token
  sendToken(user, 200, res);
});