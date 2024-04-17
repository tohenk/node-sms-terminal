#!/usr/bin/env node

/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2018-2024 Toha <tohenk@yahoo.com>
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

const path = require('path');
const Cmd = require('@ntlab/ntlib/cmd');

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

const fs = require('fs');
const Logger = require('@ntlab/ntlib/logger');
const { AtDriverIni } = require('@ntlab/gsm-at');
const { Work } = require('@ntlab/work');

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
        } else if (fs.existsSync(path.join(process.cwd(), 'config.json'))) {
            filename = path.join(process.cwd(), 'config.json');
        } else if (fs.existsSync(path.join(__dirname, 'config.json'))) {
            filename = path.join(__dirname, 'config.json');
        }
        if (filename) {
            filename = fs.realpathSync(filename);
            console.log('Reading configuration %s', filename);
            this.config = JSON.parse(fs.readFileSync(filename));
        }
        if (Cmd.get('driver') && fs.existsSync(Cmd.get('driver'))) {
            this.config.driverFilename = Cmd.get('driver');
        }
        if (Cmd.get('logdir') && fs.existsSync(Cmd.get('logdir'))) {
            this.config.logdir = Cmd.get('logdir');
        }
        let workdir = this.config.workdir ? this.config.workdir : __dirname;
        // check for default configuration
        if (!this.config.database)
            this.config.database = database;
        if (!this.config.driverFilename)
            this.config.driverFilename = AtDriverIni;
        if (!this.config.networkFilename)
            this.config.networkFilename = path.join(__dirname, 'Network.csv');
        if (!this.config.iccFilename)
            this.config.iccFilename = path.join(__dirname, 'ICC.ini');
        if (!this.config.sessiondir)
            this.config.sessiondir = path.join(workdir, 'sessions');
        if (!this.config.logdir)
            this.config.logdir = path.join(workdir, 'logs');
        if (!this.config.msgRefFilename)
            this.config.msgRefFilename = path.join(workdir, 'msgref.json');
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
            const dblogger = new Logger(path.join(this.config.logdir, 'db.log'));
            this.config.database.logging = (...args) => {
                dblogger.log.apply(dblogger, args);
            }
        }
        if (!this.config.ui) {
            this.config.ui = '@ntlab/sms-terminal-ui';
        }
        this.config.logUssd = Cmd.get('log-ussd') ? true : false;
        this.config.readNewMessage = Cmd.get('read-new-message') ? true : false;
        return true;
    }

    hashgen() {
        const crypto = require('crypto');
        const shasum = crypto.createHash('sha1');
        shasum.update(new Date().toISOString() + (Math.random() * 1000000).toString());
        return shasum.digest('hex').substr(0, 8);
    }

    createTerm() {
        this.term = require('./term');
        return this.term.init(this.config);
    }

    listTerm() {
        return new Promise((resolve, reject) => {
            const ports = Object.keys(this.term.ports);
            console.log('Available ports: %s', ports.join(', '));
            console.log('Available drivers:');
            this.term.Pool.Driver.names().forEach(drv => {
                console.log('- %s', this.term.Pool.Driver.get(drv).desc);
            });
            resolve();
        });
    }

    createUI() {
        return new Promise((resolve, reject) => {
            try {
                this.ui = require(this.config.ui)(this.config);
            } catch (err) {
                console.error('Web interface not available: ' + this.config.ui);
            }
            resolve();
        });
    }

    startTerm() {
        return new Promise((resolve, reject) => {
            // create server
            const server = require('http').Server(this.ui ? this.ui : {});
            // create socket.io server
            const opts = {};
            if (this.config.cors) {
                opts.cors = this.config.cors;
            } else {
                opts.cors = {origin: '*'};
            }
            const { Server } = require('socket.io');
            const io = new Server(server, opts);
            this.term.setSocketIo(io);
            // configure ui
            if (this.ui) {
                this.ui.title = 'SMS Terminal';
                this.ui.term = this.ui.locals.term = this.term;
                this.ui.authenticate = (username, password) => {
                    return username == this.config.security.username && password == this.config.security.password ?
                        true : false;
                }
                const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));
                this.ui.about = {
                    title: packageInfo.description,
                    version: packageInfo.version,
                    author: packageInfo.author.name ? packageInfo.author.name + ' <' + packageInfo.author.email + '>' : packageInfo.author,
                    license: packageInfo.license
                }
            }
            // start server
            const port = Cmd.get('port') || 8000;
            server.listen(port, () => {
                console.log('Application ready on port %s...', port);
            });
            // auto detect
            if (Cmd.get('auto')) {
                this.term.detectAndNotify();
            }
            resolve();
        });
    }

    run() {
        if (this.initialize()) {
            Work.works([
                [w => this.createTerm()],
                [w => this.listTerm()],
                [w => this.createUI()],
                [w => this.startTerm(), w => Object.keys(this.term.ports).length],
            ]);
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