const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const { env, origin } = require('./config');
const AppError = require('./utils/AppError');
const globalErrorHandler = require('./controllers/errorController');
const userRouter = require('./routes/userRoutes');
const interviewRouter = require('./routes/interviewRoutes');
const roundRouter = require('./routes/roundRoutes');
const questionRouter = require('./routes/questionRoutes');
const verifyRouter = require('./routes/verifyRoutes');

const app = express();
//Middlewares

//Set Security HTTP headers
app.use(helmet());
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://mrpnitjsr.vercel.app'],
    credentials: true,
  }),
);


//Dev logging
if (env === 'dev') {
  app.use(morgan('dev'));
}

//Rate limit(100reqs/10min)
const limiter = rateLimit({
  max: 100,
  window: 10 * 60 * 1000,
  message: 'Too many requests from your ip',
});

app.use(limiter);

//Body parser
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

//NoSQL sanitize
app.use(mongoSanitize());

//Data sanitization against xss
app.use(xss());

//prevent parameter pollution
app.use(
  hpp({
    whitelist: ['party', 'category', 'amount'],
  }),
);

//Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// app.use((req, res, next) => {
//   console.log(req.cookies.jwt);
//   next();
// });

//Routes
app.use('/api/v1/user', userRouter);
app.use('/api/v1/interview', interviewRouter);
app.use('/api/v1/verify', verifyRouter);
app.use('/api/v1/round', roundRouter);
app.use('/api/v1/question', questionRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
