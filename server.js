const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const {
  port,
  database,
  env,
  dbReplicaSet,
} = require('./config');

// ----------------------------------------------------
// Uncaught Exception Handler
// ----------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error(`${err.name}: ${err.message} → Uncaught Exception. Shutting down...`);
  process.exit(1);
});

// ----------------------------------------------------
// Express App and MongoDB Connection
// ----------------------------------------------------
const app = require('./app');
console.log(`Connecting to DB: ${database}`);

mongoose
  .connect(database, {
    replicaSet: env === 'dev' ? dbReplicaSet : undefined,
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ DB Connection Failed:', err.message);
    process.exit(1);
  });

// ----------------------------------------------------
// Server Start
// ----------------------------------------------------
const server = app.listen(port, () => {
  console.log(`🚀 Server running on port ${port} [${env}]`);
});

// ----------------------------------------------------
// Graceful Shutdowns
// ----------------------------------------------------
process.on('unhandledRejection', (err) => {
  console.error(`${err.name}: ${err.message} → Unhandled Rejection. Shutting down...`);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => console.log('💥 Process terminated!'));
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  server.close(() => console.log('💥 Process terminated!'));
});