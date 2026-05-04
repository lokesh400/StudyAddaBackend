require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const connectMongo = require('connect-mongo');
const MongoStore = connectMongo.MongoStore || connectMongo.default || connectMongo;
const flash = require('connect-flash');
const methodOverride = require('method-override');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');

const User = require('./models/User');
const authRoutes = require('./routes/authRoutes');
const materialRoutes = require('./routes/materialRoutes');
const adminRoutes = require('./routes/adminRoutes');

const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
// express-mongo-sanitize middleware mutates req.query and can break on newer Express.
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') mongoSanitize.sanitize(req.body);
  if (req.params && typeof req.params === 'object') mongoSanitize.sanitize(req.params);
  next();
});
if (process.env.ENABLE_REQUEST_LOGS === 'true') app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'unsafe-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
};

if (process.env.MONGO_URI) {
  sessionConfig.store =
    typeof MongoStore.create === 'function'
      ? MongoStore.create({
          mongoUrl: process.env.MONGO_URI,
          crypto: { secret: process.env.SESSION_SECRET || 'unsafe-dev-secret' },
          ttl: 14 * 24 * 60 * 60
        })
      : new MongoStore({
          mongoUrl: process.env.MONGO_URI,
          crypto: { secret: process.env.SESSION_SECRET || 'unsafe-dev-secret' },
          ttl: 14 * 24 * 60 * 60
        });
}

app.use(session(sessionConfig));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

app.use('/', authRoutes);
app.use('/', materialRoutes);
app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
  res.redirect('/materials');
});

app.use((err, req, res, next) => {
  console.error(err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong';
  res.status(statusCode).render('error', { message });
});


// Simple status route for health checks
app.get('/status', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    const server = app.listen(PORT, () => {
      console.log(`StudyAdda running on http://localhost:${PORT}`);

      // Start periodic self-checks after server is listening
      const checkUrl = `http://studyadda.tech/status`;
      const checkStatus = () => {
        http.get(checkUrl, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            console.log('Status check:', res.statusCode, body);
          });
        }).on('error', (err) => {
          console.error('Status check error:', err.message);
        });
      };

      // Run immediately, then every 10 seconds
      checkStatus();
      setInterval(checkStatus, 10 * 1000);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
})();
