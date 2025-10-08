const { env } = require('../config');
const AppError = require('../utils/AppError');

/* -------- ERROR HANDLERS --------- */

const handleCastErrorDB = (err) =>
  new AppError(`Invalid value for ${err.path}:${err.value}`, 400);

const handleDuplicateFieldsDB = (err) => {
  const [key, value] = Object.entries(err.keyValue)[0];
  return new AppError(`Duplicate value for ${key}:${value}`, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((er) => er.message);
  return new AppError(`Invalid input data. ${errors.join('. ')}`, 400);
};

const handleJWTError = () =>
  new AppError('Invalid Token. Please Login Again', 401);

const handleTokenExpiredError = () =>
  new AppError('Token Expired. Please Login Again', 401);

const handleFileNotFoundError = () => new AppError(`File not found`, 404);

/* --------- ERROR HANDLER FOR DEV ENVIRONMENT ---------- */
const sendErrorDev = (err, req, res) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }

  // B) RENDERED WEBSITE
  console.error('ERROR 💥', err);
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message,
  });
};

/* --------- ERROR HANDLER FOR PRODUCTION ENVIRONMENT ---------- */

const sendErrorProd = (err, req, res) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    // A) Operational, trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }
    // B) Programming or other unknown error: don't leak error details
    // 1) Log error
    console.error('ERROR 💥', err);
    // 2) Send generic message
    return res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!',
    });
  }

  // B) RENDERED WEBSITE
  // A) Operational, trusted error: send message to client
  if (err.isOperational) {
    console.error('ERROR 💥', err);
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: err.message,
    });
  }
  // B) Programming or other unknown error: don't leak error details
  // 1) Log error
  console.error('ERROR 💥', err);
  // 2) Send generic message
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: 'Please try again later.',
  });
};

module.exports = (err, req, res, next) => {
  err.status = err.status || 'error';
  err.statusCode = err.statusCode || 500;
  if (env === 'dev') {
    sendErrorDev(err, req, res);
  }

  if (env === 'prod') {
    let error = Object.assign(err);
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError')
      error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleTokenExpiredError();
    if (error.code === 'ENOENT') error = handleFileNotFoundError();
    sendErrorProd(error, req, res);
  }
};
