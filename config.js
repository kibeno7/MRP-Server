require('dotenv').config();

const port = process.env.PORT || 3000;
const env = process.env.NODE_ENV;
const ssl = process.env.SSL;
const database =
  env === 'dev'
    ? process.env.DATABASE_DEV
    : process.env.DATABASE_PROD.replace(
        '<password>',
        process.env.DATABASE_PROD_PASS,
      );
const dbReplicaSet = process.env.DATABASE_REPLICA_SET;
const jwtSecret = process.env.JWT_SECRET;
const jwtExpire = process.env.JWT_EXPIRE;
const jwtCookieExpire = process.env.JWT_COOKIE_EXPIRE;
const origin = process.env.ORIGIN?.split(',');
const gdriveCreds = process.env.GDRIVE_CREDENTIALS;
const gdriveCredFilename = process.env.GDRIVE_CREDENTIAL_FILENAME;
const gdriveRoot = process.env.GDRIVE_ROOT;

const config = {
  port,
  env,
  ssl,
  database,
  dbReplicaSet,
  jwtSecret,
  jwtExpire,
  jwtCookieExpire,
  origin,
  gdriveCreds,
  gdriveCredFilename,
  gdriveRoot,
};

module.exports = config;
