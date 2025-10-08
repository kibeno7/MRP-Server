const mongoose = require('mongoose');
const Interview = require('../models/interviewModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const filterObj = require('../utils/filterObj');
const Question = require('../models/questionModel');
const Round = require('../models/roundModel');
const APIFeatures = require('../utils/ApiFeatures');
const Email = require('../utils/email');
const User = require('../models/userModel');

exports.createInterview = catchAsync(async (req, res, next) => {
  const interviewData = filterObj(
    req.body,
    'company',
    'status',
    'offer',
    'compensation',
  );

  interviewData.interviewee = req.user.id;
  if (req.body.isSubmitted) {
    interviewData.verification = { status: 'in-queue' };
  }

  const session = await mongoose.startSession();
  let interview;
  session.startTransaction();
  try {
    //Create interview
    const interviewDocs = await Interview.create([interviewData], { session });
    interview = interviewDocs[0];

    //If rounds exits
    if (req.body.rounds) {
      const roundObjs = req.body.rounds;

      // For each round create an object and return id
      const rounds = await Promise.all(
        roundObjs.map(async (roundObj) => {
          const roundData = filterObj(roundObj, 'name', 'type', 'date', 'note');
          roundData.interview = interview._id;
          roundData.interviewee = req.user._id;

          const roundDocs = await Round.create([roundData], { session });
          const round = roundDocs[0];

          //if round has questions
          if (roundObj.questions) {
            const questionObjs = roundObj.questions;

            //For each question create an object and return id
            const questions = await Promise.all(
              questionObjs.map(async (questionObj) => {
                const questionData = filterObj(
                  questionObj,
                  'title',
                  'description',
                  'link',
                );

                questionData.company = interview.company;
                questionData.type = round.type;
                questionData.round = round._id;
                questionData.interview = interview._id;
                questionData.interviewee = req.user._id;

                const question = await Question.create([questionData], {
                  session,
                });

                return question[0]._id;
              }),
            );

            round.questions = questions;
            await round.save({ session });
          }

          return round._id;
        }),
      );

      interview.rounds = rounds;
      await interview.save({ session });
    }
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }

  res.status(201).json({
    status: 'success',
    data: {
      interview: interview._doc,
    },
  });
});

exports.updateInterview = catchAsync(async (req, res, next) => {
  const interview = await Interview.findById(req.params.id);

  if (!interview) {
    throw new AppError('Interview not found', 404);
  }

  if (!interview.interviewee.equals(req.user.id)) {
    throw new AppError('Interview does not belong to user', 403);
  }

  if (interview.verification.status === 'accepted') {
    throw new AppError(
      'Interview cannot be updated after verification in complete',
      403,
    );
  }

  const filteredFields = filterObj(
    req.body,
    'company',
    'status',
    'offer',
    'compensation',
  );

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      if (req.body.isSubmitted) {
        filteredFields.verification = { status: 'in-queue', faults: [] };
      }
      Object.keys(filteredFields).forEach((key) => {
        interview[key] = filteredFields[key];
      });
      if (filteredFields.company) {
        await Question.updateMany(
          { interview: interview.id },
          { company: filteredFields.company },
          { session },
        );
      }

      await interview.save({ session });
    });
  } catch (err) {
    throw new Error(err);
  } finally {
    session.endSession();
  }

  res.status(200).json({
    status: 'success',
    data: {
      interview: interview._doc,
    },
  });
});

exports.deleteInterview = catchAsync(async (req, res, next) => {
  const interview = await Interview.findById(req.params.id);

  if (!interview) {
    throw new AppError('Interview not found', 404);
  }

  if (!interview.interviewee.equals(req.user.id)) {
    throw new AppError('Interview does not belong to user', 403);
  }

  const session = await mongoose.startSession();

  //To maintain atomicity, this operation needs to be a transaction as multiple collections are being updates
  try {
    await session.withTransaction(async () => {
      await Question.deleteMany({ interview: interview._id }, { session });
      await Round.deleteMany({ interview: interview._id }, { session });
      await interview.deleteOne({ session });
    });
  } catch (err) {
    throw new Error(err);
  } finally {
    await session.endSession();
  }

  res.status(200).json({
    status: 'success',
    data: null,
  });
});

exports.getInterview = catchAsync(async (req, res, next) => {
  const interview = await Interview.findById(req.params.id)
    .populate({
      path: 'interviewee',
      select: 'name reg_no batch -_id',
    })
    .populate({
      path: 'rounds',
      select: '-interview -interviewee',
    });

  if (!interview) {
    throw new AppError('Could not find document with the given id', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      interview,
    },
  });
});

exports.getAllInterviews = catchAsync(async (req, res, next) => {
  //EXECUTING QUERY
  const apiFeatures = new APIFeatures(
    Interview.find({ verification: { status: 'accepted' } }),
    req.query,
  )
    .filter()
    .sort()
    .fields()
    .pagination();

  const { page, limit } = apiFeatures.queryString;

  const docs = await apiFeatures.query.populate({
    path: 'interviewee',
    select: 'name reg_no batch -_id',
  });
  const total = await Interview.countDocuments({
    verification: { status: 'accepted' },
  });

  const totalPages = limit && Math.ceil(total / limit);

  //SENDING RESPONSE
  res.status(200).json({
    status: 'success',
    results: docs.length,
    page: page && parseInt(page, 10),
    total,
    totalPages,
    data: {
      data: docs,
    },
  });
});

exports.getMyInterviews = catchAsync(async (req, res, next) => {
  //EXECUTING QUERY
  const apiFeatures = new APIFeatures(
    Interview.find({ interviewee: req.user.id }),
    req.query,
  )
    .filter()
    .sort()
    .fields()
    .pagination();

  const docs = await apiFeatures.query.populate({
    path: 'interviewee',
    select: 'name reg_no batch -_id',
  });
  const total = await Interview.countDocuments({ interviewee: req.user.id });

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

exports.getVerificationQueue = catchAsync(async (req, res, next) => {
  const apiFeatures = new APIFeatures(
    Interview.find({ verification: { status: 'in-queue' } }),
    req.query,
  )
    .filter()
    .sort()
    .fields()
    .pagination();

  const docs = await apiFeatures.query.populate({
    path: 'interviewee',
    select: 'name reg_no batch -_id',
  });
  const total = await Interview.countDocuments({ interviewee: req.user.id });
  res.status(200).json({
    status: 'success',
    results: docs.length,
    total,
    data: {
      data: docs,
    },
  });
});

exports.accepted = catchAsync(async (req, res, next) => {
  const interview = await Interview.findByIdAndUpdate(
    req.params.id,
    {
      verification: { status: 'accepted' },
    },
    { new: true },
  );
  const interviewee = await User.findById(interview.interviewee);

  await new Email(interviewee).sendExpAccepeted();

  res.status(200).json({
    status: 'success',
    data: {
      interview,
    },
  });
});

exports.rejected = catchAsync(async (req, res, next) => {
  const interview = await Interview.findByIdAndUpdate(req.params.id, {
    verification: { status: 'rejected' },
  });

  const interviewee = await User.findById(interview.interviewee);

  await new Email(interviewee).sendExpRejected();

  res.status(200).json({
    status: 'success',
    data: {
      interview,
    },
  });
});
