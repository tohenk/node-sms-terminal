/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2018 Toha <tohenk@yahoo.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Express security middleware.
 */

function Security(options) {
    options = options || {};
    const loginroute = options.loginroute || '/login';
    const logoutroute = options.logoutroute || '/logout';
    return (req, res, next) => {
        applySecurity(req, res);
        const path = req.originalUrl;
        // skip security on login or logout route
        if (path.indexOf(loginroute) == 0 || path.indexOf(logoutroute) == 0) {
            return next();
        }
        // skip if user already uthenticated
        if (req.session.user.authenticated) {
            return next();
        }
        if (req.xhr) {
            return res.sendStatus(401);
        }
        res.redirect(loginroute + '?r=' + path);
    }
}

function applySecurity(req, res) {
    const app = req.app;
    if (!req.session.user) {
        req.session.user = {};
    }
    app.user = {
        authenticate: (username, password) => {
            if (typeof app.authenticate == 'function') {
                return app.authenticate(username, password);
            }
            throw new Error('Application authenticate is not set');
        },
        isAuthenticated: () => {
            return req.session.user.authenticated;
        },
        login: () => {
            req.session.user.authenticated = true;
        },
        logout: () => {
            req.session.user.authenticated = false;
        }
    }
    res.user = req.user = app.user;
    app.locals.user = req.session.user;
}

module.exports = Security;