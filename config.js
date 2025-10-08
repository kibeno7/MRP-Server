require('dotenv').config();
const fs = require('fs');
const path = require('path');

const env = process.env.NODE_ENV || 'dev';
const port = process.env.PORT || 3000;

const database =
  env === 'dev'
    ? process.env.DATABASE_DEV
    : process.env.DATABASE_PROD.replace('<password>', process.env.DATABASE_PROD_PASS);

const dbReplicaSet = process.env.DATABASE_REPLICA_SET;

const jwtSecret = process.env.JWT_SECRET;
const jwtExpire = process.env.JWT_EXPIRE;
const jwtCookieExpire = process.env.JWT_COOKIE_EXPIRE;

const origin = process.env.ORIGIN?.split(',');

const gdriveCreds = process.env.GDRIVE_CREDENTIALS?.replace(/\\n/g, '\n');
const gdriveCredFilename = process.env.GDRIVE_CREDENTIAL_FILENAME;
const gdriveRoot = process.env.GDRIVE_ROOT;

// ✅ Safe writable path
const credPath =
  process.env.HEROKU === 'true'
    ? path.join('/tmp', gdriveCredFilename) // writable on Heroku
    : path.join(__dirname, gdriveCredFilename); // local dev

// ✅ Write creds only if available and file doesn't exist
if (gdriveCreds && !fs.existsSync(credPath)) {
  fs.writeFileSync(credPath, gdriveCreds);
}

module.exports = {
  port,
  env,
  database,
  dbReplicaSet,
  jwtSecret,
  jwtExpire,
  jwtCookieExpire,
  origin,
  gdriveCreds,
  gdriveCredFilename,
  gdriveRoot,
  credPath,
};