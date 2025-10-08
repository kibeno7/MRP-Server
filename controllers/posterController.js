const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { gdriveCredFilename, gdriveRoot } = require('../config');
const Interview = require('../models/interviewModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const Email = require('../utils/email');
const Drive = require('../utils/Drive');
const getPoster = require('../utils/getPoster');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  fileFilter: multerFilter,
  storage: multerStorage,
});

const drive = new Drive(path.join(__dirname, `../${gdriveCredFilename}`));

exports.uploadUserPhoto = upload.single('photo');

exports.generatePoster = catchAsync(async (req, res, next) => {
  const interview = await Interview.findById(req.params.id);
  if (!interview) {
    throw new AppError('Interview not found', 404);
  }

  if (!interview.interviewee.equals(req.user._id)) {
    throw new AppError('Interview does not belong to the current user', 403);
  }

  if (interview.verification.status !== 'accepted') {
    throw new AppError('Interview not verified', 403);
  }

  const { name, reg_no: regNo } = req.user;
  const { company } = interview;
  const { buffer: image } = req.file;

  const { stream, buffer } = await getPoster(name, regNo, company, image);

  //save file to local storage
  await fs.writeFile(
    path.join(__dirname, `../temp/${req.params.id}.png`),
    buffer,
  );

  // upload file to drive
  await drive.uploadFile(
    {
      name: `${regNo}-${req.params.id}.png`,
      mimeType: 'image/png',
      stream,
    },
    gdriveRoot,
  );

  await new Email(req.user).sendPoster([
    {
      filename: 'poster.png',
      content: stream,
    },
  ]);

  res.status(200).json({
    status: 'success',
    message: 'Poster has been generated and sent to your mail',
    download: `/api/v1/interview/${req.params.id}/poster/download`,
  });
});

exports.downloadPoster = catchAsync(async (req, res, next) => {
  const interview = await Interview.findById(req.params.id);
  if (!interview) {
    throw new AppError('Interview not found', 404);
  }

  if (!interview.interviewee.equals(req.user._id)) {
    throw new AppError('Interview does not belong to the current user', 403);
  }

  if (interview.verification.status !== 'accepted') {
    throw new AppError('Interview not verified', 403);
  }

  const filePath = path.join(__dirname, `../temp//${req.params.id}.png`);

  // Check if file specified by the filePath exists
  await fs.access(filePath, fs.constants.F_OK);

  await res.status(200).download(filePath, 'poster.png', async (err) => {
    if (err) throw err;
    await fs.unlink(filePath);
  });
});
