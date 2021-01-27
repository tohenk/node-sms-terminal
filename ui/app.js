const createError = require('http-errors');
const express = require('express');
const path = require('path');
const logger = require('morgan');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const { Helper, Security } = require('@ntlab/express-middleware');
const { ScriptManager, ScriptAsset } = require('@ntlab/ntjs');

class ExpressApp {

    app = express()

    initialize(options) {
        options = options || {};

        // view engine setup
        this.app.set('views', path.join(__dirname, 'views'));
        this.app.set('view engine', 'ejs');

        this.app.use(logger('dev'));
        this.app.use(express.json());
        this.app.use(express.urlencoded({extended: false}));
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use(express.static(require('@ntlab/ntjs-assets')));

        // session
        let sessiondir = options.sessiondir || path.join(__dirname, '..', 'sessions');
        this.app.use(session({
                name: 'smsterm',
                store: new FileStore({path: sessiondir}),
                secret: 'nt-sms-terminal',
                resave: false,
                saveUninitialized: false,
                cookie: {
                    maxAge: 3600000
                }
            })
        );

        // security
        this.app.use(Security.core());

        // app helpers
        this.app.use(Helper.core());
        this.app.use(Helper.menu());
        this.app.use(Helper.pager());

        // routes
        this.app.use('/', require('./routes/index'));
        this.app.use('/', require('./routes/security'));

        // catch 404 and forward to error handler
        this.app.use((req, res, next) => {
            next(createError(404));
        });

        // error handler
        this.app.use((err, req, res, next) => {
            // set locals, only providing error in development
            res.locals.message = err.message;
            res.locals.error = req.app.get('env') === 'development' ? err : {};

            // render the error page
            res.status(err.status || 500);
            res.render('error/error');
        });

        ScriptManager.addDefault('SemanticUI');
        ScriptManager.addAsset(ScriptAsset.STYLESHEET, 'app.css');

        // relative from layout
        this.app.slots = {
            mainmenu: {
                view: '../slot/mainmenu'
            },
            addons: {
                view: '../slot/addons'
            }
        }
    }

}

let app = null;

function run(options) {
    if (app == null) {
        app = new ExpressApp();
        app.initialize(options);
    }
    return app.app;
}

module.exports = run;