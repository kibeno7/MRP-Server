const mongoose = require('mongoose');
const User = require('./models/userModel'); // adjust path to your User model

const MONGO_URI =
  'mongodb+srv://mrpnitjsr:subrajeetinhostel@cluster0.9yjtlsf.mongodb.net/MRP?retryWrites=true&w=majority';

async function updateUserRole() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const result = await User.findOneAndUpdate(
      { email: '2023pgcsca027@nitjsr.ac.in' },
      { $set: { role: 'verifier' } },
      { new: true }
    );

    if (!result) {
      console.log('❌ User not found.');
    } else {
      console.log('✅ Role updated successfully:');
      console.log(result);
    }
  } catch (error) {
    console.error('❌ Error updating user role:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

updateUserRole();
