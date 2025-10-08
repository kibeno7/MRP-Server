const mongoose = require('mongoose');
const validator = require('validator');

const questionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Question must have a title'],
    trim: true,
    minlength: [10, 'Title must be of more than 10 characters'],
    maxlength: [100, 'Title must be of less than 100 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [300, 'Description must be of less than 300 characters'],
  },
  link: {
    type: String,
    validate: {
      validator: function (el) {
        return validator.isURL(el, {
          require_protocol: true,
          allow_query_components: true,
        });
      },
      message: 'Invalid Link',
    },
  },
  company: {
    type: String,
    required: [true, 'A question must belong to a company'],
    trim: true,
    minlength: [3, 'Company name must be of more than 3 characters'],
    maxlength: [35, 'Company name must be of less than 35 characters'],
  },
  type: {
    type: String,
    required: [true, 'A question must belong to a round'],
    enum: ['oa', 'technical', 'sys-design', 'gd', 'hr'],
  },
  round: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Round',
    immutable: true,
    required: true,
  },
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

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
