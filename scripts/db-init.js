const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { database } = require('../config');
const User = require('../models/userModel');
const Interview = require('../models/interviewModel');
const Round = require('../models/roundModel');
const Question = require('../models/questionModel');

async function importData() {
  const users = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/users.json'), 'utf-8'),
  );

  try {
    await User.create(users, { validateBeforeSave: false });
    console.log('Data Imported Successfully');
  } catch (error) {
    console.log(error);
  }
  process.exit();
}

async function deleteData() {
  try {
    await User.deleteMany();
    await Interview.deleteMany();
    await Round.deleteMany();
    await Question.deleteMany();

    console.log('Data Deleted Successfully');
  } catch (error) {
    console.log(error);
  }
  process.exit();
}

mongoose
  .connect(database)
  .then(() => {
    console.log('DB Connected');

    switch (process.argv[2]) {
      case '--import':
        importData();
        break;
      case '--delete':
        deleteData();
        break;
      default:
        console.log('Please provide --import or --delete');
        process.exit();
    }
  })
  .catch(() => console.log('Failed to connect'));
