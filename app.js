const createError = require('http-errors');
const express = require('express');
const path = require('path');
const session = require("express-session");
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const dotenv = require('dotenv').config()
const MongoStore = require('connect-mongo');


const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const adminRouter = require("./routes/admin");
const questsRouter = require("./routes/quests");

const User = require("./models/user");
const Quest = require("./models/quest");
const Skill = require("./models/skill");
const Character = require("./models/character");
const asyncHandler = require("express-async-handler");
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS
}


const app = express();
const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
const mongoDB = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.n7b0nqu.mongodb.net/inventory_application?retryWrites=true&w=majority`

main().catch((err)=>console.log(err));
async function main() {
  await mongoose.connect(mongoDB);
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/log-in');
}



const commonDataMiddleware = asyncHandler(async (req, res, next) => {
    const [
        numUsers,
        numQuests,
        numSkills,
        numCharacters
    ] = await Promise.all([
        User.countDocuments({}).exec(),
        Quest.countDocuments({}).exec(),
        Skill.countDocuments({}).exec(),
        Character.countDocuments({}).exec(),
    ]);
    res.locals.isAdmin = req.user && req.user.isAdmin;
    res.locals.user = req.user;
    res.locals.user_count = numUsers;
    res.locals.quest_count = numQuests;
    res.locals.skill_count = numSkills;
    res.locals.character_count = numCharacters;

    next();
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('trust proxy', 1); // if there's one proxy

app.use((req, res, next) => {
  req.url = req.url.replace(/\/{2,}/g, '/');
  next();
});


app.use(session({
  secret: process.env.APP_SECRET, 
  resave: false, 
  saveUninitialized: false, 
  store: MongoStore.create({ mongoUrl: mongoDB }), // Configure MongoDB session store
  cookie: { httpOnly: true,
    secure: false, 
    maxAge: 1000 * 60 * 60 * 24}}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({extended: false}));
app.use(flash());

app.use(logger('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(commonDataMiddleware);


app.use('/', usersRouter);
app.use('/admin', adminRouter);
app.use('/quests', questsRouter);



passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({username: username});
      if (!user) {
        return done(null, false, {message: "Username not found."});

      };
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return done(null, false, {message: "Incorrect password."});
      };
      return done(null, user);
    } catch(err) {
      return done(err);
    };
  })
);

passport.serializeUser((user, done) => {

  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {


  try{ 
    const user = await User.findById(id);
    done(null, user);
  } catch(err) {
    done(err);
  };
});
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


module.exports = app;
const port = process.env.PORT || 3000; // Use the environment variable PORT, or 3000 if it's not set
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
