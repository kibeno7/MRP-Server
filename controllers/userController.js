const crypto = require('crypto');
const csv = require('csv-parser');
const { Readable } = require('stream');
const multer = require('multer');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const APIFeatures = require('../utils/ApiFeatures');
const filterObj = require('../utils/filterObj');

const storage = multer.memoryStorage();

const upload = multer({ storage: storage });

exports.uploadBatch = upload.single('batch');

exports.updateMe = catchAsync(async (req, res, next) => {
  //If password data, throw error
  if (req.body.password || req.body.passwordConfirm || req.body.role) {
    throw new AppError('This route is not for updating password or role', 400);
  }

  //Filer unwanted fields
  const filteredBody = filterObj(req.body, 'name', 'email', 'photo');

  const updatedUser = await User.findByIdAndUpdate(req.user._id, filteredBody, {
    runValidators: true,
    new: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

//User management
exports.deleteUser = catchAsync(async (req, res, next) => {
  const doc = await User.findOneAndDelete({
    reg_no: req.params.regNo.toLowerCase(),
  });

  if (!doc) {
    throw new AppError('Could not find document with the given id', 404);
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.password) {
    throw new AppError(
      'Password can only be updated by the respective user',
      400,
    );
  }

  const doc = await User.findOneAndUpdate(
    { reg_no: req.params.regNo.toLowerCase() },
    req.body,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!doc) {
    throw new AppError('Could not find document with the given id', 404);
  }

  res.status(200).json({
    status: 'success',
    data: doc,
  });
});

exports.createUser = catchAsync(async (req, res, next) => {
  //Generate random password for new users password
  const token = crypto.randomBytes(32).toString('hex');
  req.body.password = token;
  req.body.passwordConfirm = token;

  const doc = await User.create(req.body);
  res.status(200).json({
    status: 'success',
    data: doc._doc,
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const doc = await User.findOne({ reg_no: req.params.regNo.toLowerCase() });

  if (!doc) {
    throw new AppError('Could not find document with the given id', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      doc,
    },
  });
});

exports.getAllUsers = catchAsync(async (req, res, next) => {
  //EXECUTING QUERY
  const apiFeatures = new APIFeatures(User.find(), req.query)
    .filter()
    .sort()
    .fields()
    .pagination();

  const docs = await apiFeatures.query;
  const total = await User.countDocuments();

  //SENDING RESPONSE
  res.status(200).json({
    status: 'success',
    results: docs.length,
    total,
    data: {
      data: docs,
    },
  });
});

exports.batchEntry = catchAsync(async (req, res, next) => {
  if (!req.file) {
    throw new AppError('No CSV file uploaded!', 400);
  }

  const year = parseInt(req.params.year, 10);

  const bufferStream = new Readable();
  bufferStream.push(req.file.buffer);
  bufferStream.push(null);

  const users = await new Promise((resolve, reject) => {
    const results = [];
    bufferStream
      .pipe(csv())
      .on('data', (data) => {
        if (!data.regno) {
          return;
        }
        const user = {
          name: data.name || '', // Ensure name is provided
          reg_no: data.regno.toLowerCase(), // Ensure reg_no is provided
          batch: year,
          email: `${data.regno.toLowerCase()}@nitjsr.ac.in`, // Ensure email is unique
          password: '12345678',
          passwordConfirm: '12345678',
        };
        results.push(user);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (err) => {
        reject(new AppError(`Error reading CSV file - ${err.message}`, 400));
      });
  });

  const failedEntries = [];

  const createUser = async (user) => {
    try {
      return await User.create(user);
    } catch (err) {
      failedEntries.push(`${user.reg_no} - ${err.message}`);
    }
  };

  const entries = users.map((user) => createUser(user));

  await Promise.all(entries);
  res.status(200).json({
    status: 'success',
    data: {
      total: users.length,
      entries: users.length - failedEntries.length,
      failed: failedEntries.length,
      failedEntries,
    },
  });
});
