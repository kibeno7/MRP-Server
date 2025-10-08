const mongoose = require('mongoose');
// const AppError = require('../utils/AppError');

const interviewSchema = new mongoose.Schema({
  interviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'An Interview must be of an interviewe'],
    immutable: true,
  },
  company: {
    type: String,
    required: [true, 'An Interview must belong to a company'],
    trim: true,
    minlength: [3, 'Comapany name must be of more than 3 characters'],
    maxlength: [35, 'Comapany name must be of less than 35 characters'],
  },
  rounds: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Round',
      },
    ],
  },
  status: {
    type: String,
    enum: ['ongoing', 'placed', 'not-placed'],
    default: 'ongoing',
  },
  verification: {
    status: {
      type: String,
      enum: ['not-verified', 'in-queue', 'accepted', 'rejected'],
      default: 'not-verified',
    },
  },
  offer: {
    type: String,
    enum: ['fte', 'intern'],
  },
  compensation: {
    type: Number,
  },
  poster: String,
  createdAt: {
    type: Number,
    default: Date.now,
  },
});

// interviewSchema.pre(
//   ['save', 'update', 'updateOne', 'findOneAndUpdate'],
//   async function (next) {
//     if (this.status === 'placed') {
//       if (!this.offer || !this.compensation) {
//         return next(
//           new AppError(
//             'Please provide offer and compensation if you are placed',
//             400,
//           ),
//         );
//       }
//     } else {
//       this.offer = undefined;
//       this.compensation = undefined;
//     }
//     return next();
//   },
// );

const Interview = mongoose.model('Interview', interviewSchema);

module.exports = Interview;
