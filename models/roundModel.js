const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Round must have a name'],
  },
  type: {
    type: String,
    required: [true, 'A round must have a type'],
    enum: ['oa', 'technical', 'sys-design', 'gd', 'hr'],
  },
  date: {
    type: Number,
    required: [true, 'A round must have a date'],
  },
  note: {
    type: String,
    maxlength: [512, 'Note must be of less than 512 characters'],
  },
  questions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
    },
  ],
  interview: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Interview',
    immutable: true,
    required: true,
  },
  interviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true,
  },
  createdAt: {
    type: Number,
    default: Date.now,
  },
});

roundSchema.index({ name: 1, interview: 1 }, { unique: true });

roundSchema.pre(/\bfind\w*/, function (next) {
  this.populate({
    path: 'questions',
    select: '-interview -interviewee -round',
  });
  next();
});

const Round = mongoose.model('Round', roundSchema);

module.exports = Round;
