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
    'title',
    'description',
    'link',
    'round',
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

  const round = await Round.findById(filteredObj.round);
  if (!round) {
    throw new AppError('Round not found!', 404);
  }

  if (!round.interview.equals(interview.id)) {
    throw new AppError("Round doesn't belong to the given interview.", 400);
  }
  filteredObj.interviewee = req.user.id;
  filteredObj.company = interview.company;
  filteredObj.type = round.type;
  let question;

  const session = await mongoose.startSession();

  try {
    const questionDoc = await Question.create([filteredObj], { session });
    question = questionDoc[0];
    round.questions.push(question);
    await round.save({ session });
  } catch (err) {
    throw new Error(err);
  } finally {
    await session.endSession();
  }

  res.status(200).json({
    status: 'success',
    data: {
      question: question._doc,
    },
  });
});

exports.update = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.params.id);
  if (!question) {
    throw new AppError('Question not found!', 404);
  }

  if (!question.interviewee.equals(req.user.id)) {
    throw new AppError(
      'User is not same for the fetched question object.',
      400,
    );
  }

  if (req.body.title) {
    question.title = req.body.title;
  }
  if (req.body.description) {
    question.description = req.body.description;
  }
  if (req.body.link) {
    question.link = req.body.link;
  }
  await question.save();
  res.status(200).json({
    status: 'success',
    data: {
      question: question._doc,
    },
  });
});

exports.delete = catchAsync(async (req, res, next) => {
  const question = await Question.findById(req.params.id);
  if (!question) {
    throw new AppError('Question not found!', 404);
  }
  if (!question.interviewee.equals(req.user.id)) {
    throw new AppError(
      'User is not same for the fetched question object.',
      400,
    );
  }

  await Question.findByIdAndDelete(question._id);
  res.status(204).json({
    status: 'success',
    data: null,
  });
});
