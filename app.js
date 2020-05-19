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
const AppTerm       = require('./term');

const database = {
    dialect: 'mysql',
    host: 'localhost',
    username: 'root',
    password: null,
    database: 'smsgw'
}
let config = {};
let configFile;
// read configuration from command line values
if (Cmd.get('config') && fs.existsSync(Cmd.get('config'))) {
    configFile = Cmd.get('config');
} else if (fs.existsSync(path.join(__dirname, 'config.json'))) {
    configFile = path.join(__dirname, 'config.json');
}
if (configFile) {
    console.log('Reading configuration %s', configFile);
    config = JSON.parse(fs.readFileSync(configFile));
}
if (Cmd.get('driver') && fs.existsSync(Cmd.get('driver'))) {
    config.driverFilename = Cmd.get('driver');
}
if (Cmd.get('logdir') && fs.existsSync(Cmd.get('logdir'))) {
    config.logdir = Cmd.get('logdir');
}
// check for default configuration
if (!config.database)
    config.database = database;
if (!config.driverFilename)
    config.driverFilename = path.join(__dirname, 'Drivers.ini');
if (!config.networkFilename)
    config.networkFilename = path.join(__dirname, 'Network.csv');
if (!config.iccFilename)
    config.iccFilename = path.join(__dirname, 'ICC.ini');
if (!config.logdir)
    config.logdir = path.join(__dirname, 'logs');
if (!config.msgRefFilename)
    config.msgRefFilename = path.join(__dirname, 'msgref.json');
if (!config.secret) {
    config.secret = hashgen();
    console.log('Using secret: %s', config.secret);
}
if (!config.security) config.security = {};
if (!config.security.username) {
    config.security.username = 'admin';
    console.log('Web interface username using default: %s', config.security.username);
}
if (!config.security.password) {
    config.security.password = hashgen();
    console.log('Web interface password generated: %s', config.security.password);
}
if (!config.database.logging) {
    const dblogger = new ntLogger(path.join(config.logdir, 'db.log'));
    config.database.logging = function() {
        dblogger.log.apply(dblogger, Array.from(arguments));
    }
}
config.logUssd = Cmd.get('log-ussd') ? true : false;
config.readNewMessage = Cmd.get('read-new-message') ? true : false;

AppTerm.init(config).then(() => {
    run();
}).catch((err) => {
    if (err instanceof Error) {
        console.log('%s: %s', err.name, err.message);
    } else {
        console.log(err);
    }
});

function run() {
    const ports = Object.keys(AppTerm.ports);
    console.log('Available ports: %s', ports.join(', '));
    console.log('Available drivers:');
    AppTerm.Pool.Driver.names().forEach((drv) => {
        console.log('- %s', AppTerm.Pool.Driver.get(drv).desc);
    });
    console.log('\n');
    if (ports.length) {
        const port = Cmd.get('port') | 8000;
        const app = require('./ui/app');
        const http = require('http').Server(app);
        const io = require('socket.io')(http);
        AppTerm.setSocketIo(io);
        app.title = 'SMS Terminal';
        app.term = app.locals.term = AppTerm;
        app.authenticate = (username, password) => {
            return username == config.security.username && password == config.security.password ?
                true : false;
        }
        http.listen(port, () => {
            console.log('Application ready on port %s...', port);
        });
        if (Cmd.get('auto')) {
            AppTerm.detectAll().catch((err) => {
                console.log('Detection error: %s', err);
            });
        }
    }
}

function hashgen() {
    const shasum = crypto.createHash('sha1');
    shasum.update(ntUtil.formatDate(new Date(), 'yyyyMMddHHmmsszzz') + (Math.random() * 1000000).toString());
    return shasum.digest('hex').substr(0, 8);
}

function usage() {
    console.log('Usage:');
    console.log('  node %s [options]', path.basename(process.argv[1]));
    console.log('');
    console.log('Options:');
    console.log(Cmd.dump());
    console.log('');
    return true;
}