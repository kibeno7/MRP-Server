const mongoose = require('mongoose');
const filterObj = require('../utils/filterObj');
const catchAsync = require('../utils/catchAsync');
const Interview = require('../models/interviewModel');
const Round = require('../models/roundModel');
const Question = require('../models/questionModel');
const AppError = require('../utils/AppError');

exports.create = catchAsync(async (req, res, next) => {
  const filteredObj = filterObj(
    req.body,
    'name',
    'type',
    'date',
    'note',
    'interview',
  );
  const interview = await Interview.findById(filteredObj.interview);
  if (!interview) {
    throw new AppError('Interview not found!', 404);
  }

  if (!interview.interviewee.equals(req.user.id)) {
    throw new AppError(
      'User is not same for the fetched interview object.',
      400,
    );
  }

  filteredObj.interviewee = req.user.id;
  let round;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const roundDocs = await Round.create([filteredObj], { session });
      round = roundDocs[0];
      if (req.body.questions?.length) {
        const questionObjs = req.body.questions;

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
      }
      await round.save({ session });
    });
  } catch (err) {
    throw new Error(err);
  } finally {
    await session.endSession();
  }
  res.status(200).json({
    status: 'success',
    data: {
      round: round._doc,
    },
  });
});

exports.update = catchAsync(async (req, res, next) => {
  const round = await Round.findById(req.params.id);
  if (!round) {
    throw new AppError('Round not found!', 404);
  }

  if (!round.interviewee.equals(req.user.id)) {
    throw new AppError('User is not same for the fetched round object.', 400);
  }
  const session = await mongoose.startSession();

  try {
    if (req.body.name) {
      round.name = req.body.name;
    }
    if (req.body.type) {
      round.type = req.body.type;
      await Question.updateMany(
        { round: round._id },
        { $set: { type: round.type } },
        { session },
      );
    }
    if (req.body.date) {
      round.date = req.body.date;
    }
    if (req.body.note) {
      round.note = req.body.note;
    }
    await round.save({ session });
  } catch (err) {
    throw new Error(err);
  } finally {
    await session.endSession();
  }

  res.status(200).json({
    status: 'success',
    data: {
      round: round._doc,
    },
  });
});

exports.delete = catchAsync(async (req, res, next) => {
  const round = await Round.findById(req.params.id);

  if (!round) {
    throw new AppError('Round not found!', 404);
  }
  if (!round.interviewee.equals(req.user.id)) {
    throw new AppError(
      'User is not same for the fetched question object.',
      400,
    );
  }

  const session = await mongoose.startSession();
  try {
    await Question.deleteMany({ round: round._id }, { session });
    const interview = await Interview.findById(round.interview);
    interview.rounds.pull(round._id);
    await interview.save({ session });
    await round.deleteOne({ session });
  } catch (err) {
    throw new Error(err);
  } finally {
    await session.endSession();
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
