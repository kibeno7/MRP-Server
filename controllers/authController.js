const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpire, jwtCookieExpire, ssl } = require('../config');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const Email = require('../utils/email');

const signToken = (id, role) =>
  jwt.sign({ id, role }, jwtSecret, {
    expiresIn: jwtExpire,
  });

const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id, user.role);

  const cookieOptions = {
    expires: new Date(Date.now() + jwtCookieExpire * 24 * 60 * 60 * 1000),
    httpOnly: true,
    //hhtp only cookie needs to be sent through secure channel only, mandatorily if it is being done cross-site
    sameSite: 'None',
    secure: ssl,
  };

  res.cookie('jwt', token, cookieOptions);
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: user,
    },
  });
};

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

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1. Check if email and password not null
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  //2. Check if user exist
  const user = await User.findOne({ email, active: { $ne: false } }).select(
    '+password',
  );

  //3. Check if password match
  const correct = await user?.checkPassword(password, user.password);

  if (!user || !correct) {
    throw new AppError('Incorrect email or password', 401);
  }

  //4. Sign token
  sendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
    //hhtp only cookie needs to be sent through secure channel only, mandatorily if it is being done cross-site
    sameSite: 'None',
    secure: ssl,
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  //check for jwt
  const { authorization } = req.headers;
  let token;
  if (authorization && authorization.startsWith('Bearer')) {
    token = authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    throw new AppError('Please login to access this route', 401);
  }

  //veryfiy jwt
  const decoded = await promisify(jwt.verify)(token, jwtSecret);

  //if valid, check user exist
  const user = await User.findById(decoded.id);

  if (!user) {
    throw new AppError('User does not exist', 401);
  }

  //check for password change after jwt issue
  if (user.isPasswordChangedAfter(decoded.iat)) {
    throw new AppError(
      'Password has been changed recently. Please login again!',
      401,
    );
  }

  //Grant Access
  req.user = user;
  next();
});

exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET,
      );

      // 2) Check if user still exists
      let currentUser = await User.findById(decoded.id).select('+active');
      if (!currentUser?.active) currentUser = undefined;

      if (!currentUser) {
        throw new Error();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.isPasswordChangedAfter(decoded.iat)) {
        throw new Error();
      }

      // THERE IS A LOGGED IN USER

      req.user = currentUser;
      res.status(200).json({
        status: 'success',
        data: {
          user: currentUser,
        },
      });
    } catch (err) {
      res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 5 * 1000),
        httpOnly: true,
        sameSite: 'None',
        secure: ssl,
      });
      res.status(200).json({
        status: 'success',
        data: {
          user: null,
        },
      });
    }
  } else {
    res.status(200).json({
      status: 'success',
      data: {
        user: null,
      },
    });
  }
};

/*
restrictTo takes the roles and then returns a middleware that will check for those roles.
So, while mounting we need to call this with the roles, unlike other middlewares where we
just pass the function.
*/
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
