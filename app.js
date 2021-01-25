/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2018-2020 Toha <tohenk@yahoo.com>
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

/*
 * Main App handler.
 */

const path          = require('path');
const Cmd           = require('./lib/cmd');

Cmd.addBool('help', 'h', 'Show program usage').setAccessible(false);
Cmd.addVar('config', '', 'Read app configuration from file', 'config-file');
Cmd.addVar('driver', '', 'Read driver from file', 'driver-file');
Cmd.addVar('port', 'p', 'Set web server port to listen', 'port');
Cmd.addVar('logdir', '', 'Set the log file location', 'directory');
Cmd.addBool('auto', 'a', 'Automatically open all available ports');
Cmd.addBool('read-new-message', '', 'Once the terminal opened, try to read new messages');
Cmd.addBool('log-ussd', 'u', 'Add ussd command to activity');

if (!Cmd.parse() || (Cmd.get('help') && usage())) {
    process.exit();
}

const crypto        = require('crypto');
const fs            = require('fs');
const ntUtil        = require('./lib/util');
const ntLogger      = require('./lib/logger');

const database = {
    dialect: 'mysql',
    host: 'localhost',
    username: 'root',
    password: null,
    database: 'smsgw'
}

class App {

    config = {}
    term = null

    initialize() {
        let filename;
        // read configuration from command line values
        if (Cmd.get('config') && fs.existsSync(Cmd.get('config'))) {
            filename = Cmd.get('config');
        } else if (fs.existsSync(path.join(__dirname, 'config.json'))) {
            filename = path.join(__dirname, 'config.json');
        }
        if (filename) {
            console.log('Reading configuration %s', filename);
            this.config = JSON.parse(fs.readFileSync(filename));
        }
        if (Cmd.get('driver') && fs.existsSync(Cmd.get('driver'))) {
            this.config.driverFilename = Cmd.get('driver');
        }
        if (Cmd.get('logdir') && fs.existsSync(Cmd.get('logdir'))) {
            this.config.logdir = Cmd.get('logdir');
        }
        // check for default configuration
        if (!this.config.database)
            this.config.database = database;
        if (!this.config.driverFilename)
            this.config.driverFilename = path.join(__dirname, 'Drivers.ini');
        if (!this.config.networkFilename)
            this.config.networkFilename = path.join(__dirname, 'Network.csv');
        if (!this.config.iccFilename)
            this.config.iccFilename = path.join(__dirname, 'ICC.ini');
        if (!this.config.logdir)
            this.config.logdir = path.join(__dirname, 'logs');
        if (!this.config.msgRefFilename)
            this.config.msgRefFilename = path.join(__dirname, 'msgref.json');
        if (!this.config.secret) {
            this.config.secret = this.hashgen();
            console.log('Using secret: %s', this.config.secret);
        }
        if (!this.config.security) this.config.security = {};
        if (!this.config.security.username) {
            this.config.security.username = 'admin';
            console.log('Web interface username using default: %s', this.config.security.username);
        }
        if (!this.config.security.password) {
            this.config.security.password = this.hashgen();
            console.log('Web interface password generated: %s', this.config.security.password);
        }
        if (!this.config.database.logging) {
            const dblogger = new ntLogger(path.join(this.config.logdir, 'db.log'));
            this.config.database.logging = (...args) => {
                dblogger.log.apply(dblogger, args);
            }
        }
        this.config.logUssd = Cmd.get('log-ussd') ? true : false;
        this.config.readNewMessage = Cmd.get('read-new-message') ? true : false;
        return true;
    }

    hashgen() {
        const shasum = crypto.createHash('sha1');
        shasum.update(ntUtil.formatDate(new Date(), 'yyyyMMddHHmmsszzz') + (Math.random() * 1000000).toString());
        return shasum.digest('hex').substr(0, 8);
    }

    createTerm(callback) {
        this.term = require('./term');
        this.term.init(this.config)
            .then(() => {
                callback();
            })
            .catch((err) => {
                if (err instanceof Error) {
                    console.log('%s: %s', err.name, err.message);
                } else {
                    console.log(err);
                }
            })
        ;
    }

    startTerm() {
        const ports = Object.keys(this.term.ports);
        console.log('Available ports: %s', ports.join(', '));
        console.log('Available drivers:');
        this.term.Pool.Driver.names().forEach((drv) => {
            console.log('- %s', this.term.Pool.Driver.get(drv).desc);
        });
        console.log('');
        if (ports.length) {
            const port = Cmd.get('port') || 8000;
            const app = require('./ui/app');
            const http = require('http').Server(app);
            const io = require('socket.io')(http);
            this.term.setSocketIo(io);
            app.title = 'SMS Terminal';
            app.term = app.locals.term = this.term;
            app.authenticate = (username, password) => {
                return username == this.config.security.username && password == this.config.security.password ?
                    true : false;
            }
            http.listen(port, () => {
                console.log('Application ready on port %s...', port);
            });
            if (Cmd.get('auto')) {
                this.term.detectAll().catch((err) => {
                    console.log('Detection error: %s', err);
                });
            }
        }
    }

    run() {
        if (this.initialize()) {
            this.createTerm(() => {
                this.startTerm();
            });
        }
    }

}

(function run() {
    new App().run();
})();

function usage() {
    console.log('Usage:');
    console.log('  node %s [options]', path.basename(process.argv[1]));
    console.log('');
    console.log('Options:');
    console.log(Cmd.dump());
    console.log('');
    return true;
}