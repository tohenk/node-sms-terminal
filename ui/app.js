const createError = require('http-errors');
const express = require('express');
const path = require('path');
const logger = require('morgan');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const { Helper, Security } = require('@ntlab/express-middleware');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(require('@ntlab/ntjs-assets')));

// session
app.use(session({
    name: 'smsterm',
    store: new FileStore({path: path.join(__dirname, '..', 'sessions')}),
    secret: 'nt-sms-terminal',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 3600000
    }
  })
);

// security
app.use(Security.core());

// app helpers
app.use(Helper.core());
app.use(Helper.menu());
app.use(Helper.pager());

// routes
app.use('/', require('./routes/index'));
app.use('/', require('./routes/security'));

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
  res.render('error/error');
});

const { ScriptManager, ScriptAsset } = require('@ntlab/ntjs');
ScriptManager.addDefault('SemanticUI');
ScriptManager.addAsset(ScriptAsset.STYLESHEET, 'app.css');

// relative from layout
app.slots = {
  mainmenu: {
    view: '../slot/mainmenu'
  },
  addons: {
    view: '../slot/addons'
  }
};

module.exports = app;