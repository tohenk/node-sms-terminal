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

const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const ini = require('ini');
const util = require('util');
const { SerialPort } = require('serialport');
const Logger = require('@ntlab/ntlib/logger');
const { Queue, Work } = require('@ntlab/work');
const { AtPool, AtConst } = require('@ntlab/gsm-at');
const AppStorage = require('./storage');

/**
 * Terminal handler.
 */
class AppTerm {

    Pool = AtPool
    Storage = AppStorage
    ClientRoom = 'clients'

    init(config) {
        this.config = config;
        this.clients = [];
        this.msgRefFilename = config.msgRefFilename;
        this.networkFilename = config.networkFilename;
        this.iccFilename = config.iccFilename;
        this.logUssd = config.logUssd ? config.logUssd : false;
        this.optionsMap = {
            deleteMessage: 'deleteMessageOnRead',
            deliveryReport: 'requestMessageStatus',
            requestReply: 'requestMessageReply',
            emptyWhenFull: 'emptyWhenFull'
        }
        return Work.works([
            [w => this.initializeLogger()],
            [w => this.loadNetworks()],
            [w => this.loadICC()],
            [w => this.initializePool()],
            [w => this.listPorts()],
            [w => this.Storage.init(config.database)],
        ]);
    }

    initializeLogger() {
        return new Promise((resolve, reject) => {
            this.logdir = this.config.logdir || path.join(__dirname, 'logs');
            this.logfile = path.join(this.logdir, 'terminal.log');
            this.logger = new Logger(this.logfile);
            resolve();
        });
    }

    initializePool() {
        return new Promise((resolve, reject) => {
            this.Pool.Driver.load(this.config.driverFilename);
            this.Pool.Stk.load(this.config.stkDriverFilename);
            this.Pool.init(portName => {
                return new Promise((resolve, reject) => {
                    const portId = this.ports[portName];
                    if (portId) {
                        const port = new SerialPort({path: portId, baudRate: 115200}, err => {
                            if (err) {
                                return reject(err.message);
                            }
                            resolve(port);
                        });
                    } else {
                        reject('Port ' + portName + ' does not exist.');
                    }
                });
            }, this.config);
            resolve();
        });
    }

    listPorts() {
        return new Promise((resolve, reject) => {
            this.ports = {};
            SerialPort.list()
                .then((ports, err) => {
                    if (err) {
                        return reject(err);
                    }
                    ports.forEach(item => {
                        const portName = path.basename(item.path);
                        this.ports[portName] = item.path;
                    });
                    resolve();
                })
            ;
        });
    }

    loadNetworks() {
        this.networks = [];
        return new Promise((resolve, reject) => {
            if (this.networkFilename && fs.existsSync(this.networkFilename)) {
                const netCsv = csv
                    .parse({headers: true, delimiter: ';', objectMode: true})
                    .on('data', data => this.networks.push(data))
                    .on('end', () => resolve());
                fs.createReadStream(this.networkFilename).pipe(netCsv);
            } else {
                resolve();
            }
        });
    }

    loadICC() {
        return new Promise((resolve, reject) => {
            if (this.iccFilename && fs.existsSync(this.iccFilename)) {
                this.icc = ini.parse(fs.readFileSync(this.iccFilename, 'utf-8'));
            }
            resolve();
        });
    }

    getICC(country) {
        if (this.icc) {
            for (const code in this.icc.ICC) {
                const ctry = this.icc.ICC[code];
                if (ctry.indexOf(country) >= 0) {
                    return this.cleanICC(code);
                }
            }
        }
    }

    cleanICC(code) {
        const result = code.split('-');
        return result.length ? result[0] : code;
    }

    splitNumber(phoneNumber) {
        const result = [];
        if (this.icc) {
            if (phoneNumber.charAt(0) === '+') {
                phoneNumber = phoneNumber.substr(1);
            }
            for (const code in this.icc.ICC) {
                const icc = this.cleanICC(code);
                if (phoneNumber.substr(0, icc.length) === icc) {
                    result.push(icc);
                    result.push(phoneNumber.substr(icc.length));
                }
            }
        }
        return result;
    }

    get(portName) {
        return this.Pool.get(portName);
    }

    open(portName) {
        return Work.works([
            [w => this.Pool.open(portName)],
            [w => Promise.resolve(this.applyHandler(w.getRes(0)))],
            [w => w.getRes(1).listMessage(AtConst.SMS_STAT_RECV_UNREAD),
                w => this.config.readNewMessage],
        ]);
    }

    applyHandler(gsm) {
        if (!gsm.initialized) {
            gsm.initialized = true;
            gsm.msgRefFilename = this.msgRefFilename;
            const done = activity => {
                if (this.uiCon) {
                    this.uiCon.emit('new-activity', activity.type);
                }
                this.notifyActivity(activity);
                console.log('%s: Done processing activity (%d) %s', gsm.name, activity.type, activity.hash);
            }
            // ---- OUTGOING ----
            gsm.on('pdu', (success, messages) => {
                let hash = null;
                let address = null;
                let content = '';
                messages.forEach(message => {
                    if (null === hash) {
                        hash = message.hash;
                    }
                    if (null === address) {
                        address = message.address;
                    }
                    content += message.message;
                    this.Storage.savePdu(gsm.info.imsi, message);
                });
                this.log('%s <-- SEND %s: %s\n%s', gsm.name, success ? 'OK' : 'FAIL', address, content);
                // save as SMS activity
                this.Storage.saveActivity(gsm.info.imsi, {
                    hash: hash,
                    type: this.Storage.ACTIVITY_SMS,
                    address: address,
                    data: content,
                    status: success ? 1 : 0
                }, done);
            });
            gsm.on('dial', (success, data) => {
                this.log('%s <-- DIAL %s: %s', gsm.name, success ? 'OK' : 'FAIL', data.address);
                // save as CALL activity
                this.Storage.saveActivity(gsm.info.imsi, {
                    hash: data.hash,
                    type: this.Storage.ACTIVITY_CALL,
                    address: data.address,
                    data: null,
                    status: success ? 1 : 0
                }, done);
            });
            gsm.on('ussd-dial', (success, data) => {
                this.log('%s <-- USSD %s: %s', gsm.name, success ? 'OK' : 'FAIL', data.address);
                // save as USSD activity
                if (this.logUssd) {
                    this.Storage.saveActivity(gsm.info.imsi, {
                        hash: data.hash,
                        type: this.Storage.ACTIVITY_USSD,
                        address: data.address,
                        data: null,
                        status: success ? 1 : 0
                    }, done);
                }
            });
            // ---- INCOMING ----
            gsm.on('status-report', msg => {
                this.log('%s <-- Status report: %s', gsm.name, msg.address);
                this.Storage.saveReport(gsm.info.imsi, msg, (report) => {
                    if (this.termCon) {
                        this.termCon.to(this.ClientRoom).emit('status-report', report);
                    }
                });
            });
            gsm.on('message', messages => {
                messages = Array.isArray(messages) ? messages : [messages];
                let hash = null;
                let address = null;
                let content = '';
                messages.forEach((message) => {
                    if (null === hash) {
                        hash = message.hash;
                    }
                    if (null === address) {
                        address = message.address;
                    }
                    content += message.message;
                    this.Storage.savePdu(gsm.info.imsi, message);
                });
                if (content.length) {
                    this.log('%s <-- SMS: %s\n%s', gsm.name, address, content);
                    // save as INBOX activity
                    this.Storage.saveActivity(gsm.info.imsi, {
                        hash: hash,
                        type: this.Storage.ACTIVITY_INBOX,
                        address: address,
                        data: content,
                        status: this.clients.length ? 1 : 0
                    }, done);
                }
            });
            gsm.on('ussd', ussd => {
                if (ussd.message) {
                    this.log('%s <-- USSD: %s', gsm.name, ussd.message);
                    // save as CUSD activity
                    this.Storage.saveActivity(gsm.info.imsi, {
                        hash: gsm.getHash(gsm.ussdCode, ussd.message),
                        type: this.Storage.ACTIVITY_CUSD,
                        address: gsm.ussdCode ? gsm.ussdCode : null,
                        data: ussd.message,
                        status: this.clients.length ? 1 : 0
                    }, done);
                }
            });
            gsm.on('ring', caller => {
                this.log('%s <-- CALL: %s', gsm.name, caller);
                // save as RING activity
                this.Storage.saveActivity(gsm.info.imsi, {
                    hash: gsm.getHash(gsm.intlNumber(gsm.caller)),
                    type: this.Storage.ACTIVITY_RING,
                    address: gsm.intlNumber(gsm.caller),
                    data: null,
                    status: this.clients.length ? 1 : 0
                }, done);
            });
            gsm.on('log', message => {
                if (this.uiCon) {
                    this.uiCon.emit('log', {term: gsm.name, time: Date.now(), message: message});
                }
            });
            gsm.on('stk', data => {
                if (this.uiCon) {
                    this.uiCon.emit('stk', {term: gsm.name, data});
                }
            });
            if (gsm.info.imsi && this.io) {
                gsm.io = this.io.of(this.config.getPath('/' + gsm.info.imsi));
                gsm.io.on('connection', socket => {
                    console.log('IMSI %s connected: %s', gsm.info.imsi, socket.id);
                    socket.on('disconnect', () => {
                        console.log('IMSI %s disconnected: %s', gsm.info.imsi, socket.id);
                    });
                    socket.on('info', () => {
                        socket.emit('info', {
                            manufacturer: gsm.info.manufacturer,
                            model: gsm.info.model,
                            version: gsm.info.version,
                            serial: gsm.info.serial,
                            imsi: gsm.info.imsi,
                            smsc: gsm.props.smsc,
                            network: gsm.props.network
                        });
                    });
                    socket.on('setopt', opts => {
                        Object.keys(this.optionsMap).forEach(opt => {
                            if (opts[opt] !== undefined) {
                                gsm.options[this.optionsMap[opt]] = opts[opt];
                                console.log('%s: Option %s set to %s', gsm.name, this.optionsMap[opt],
                                    util.inspect(opts[opt]));
                            }
                        });
                    });
                    socket.on('getopt', () => {
                        const opts = {};
                        Object.keys(this.optionsMap).forEach(opt => {
                            if (gsm.options[this.optionsMap[opt]] !== undefined) {
                                opts[opt] = gsm.options[this.optionsMap[opt]];
                            }
                        });
                        socket.emit('getopt', opts);
                    });
                    socket.on('state', () => {
                        socket.emit('state', {idle: gsm.idle && gsm.queueCount() === 0});
                    });
                    socket.on('hash', data => {
                        switch (data.type) {
                            case this.Storage.ACTIVITY_CALL:
                                data.address = gsm.intlNumber(data.address);
                                data.hash = gsm.getHash(data.time, data.address);
                                break;
                            case this.Storage.ACTIVITY_SMS:
                                data.address = gsm.intlNumber(data.address);
                                data.hash = gsm.getHash(data.time, data.address, data.data);
                                break;
                            case this.Storage.ACTIVITY_USSD:
                                data.hash = gsm.getHash(data.time, data.address);
                                break;
                        }
                        socket.emit('hash', data);
                    });
                    socket.on('status-report', hash => {
                        this.Storage.findPdu(gsm.info.imsi, hash, status => {
                            socket.emit('status-report', status);
                        });
                    });
                    socket.on('status', (hash) => {
                        this.Storage.Activity.findOne({where: {imsi: gsm.info.imsi, hash: hash}})
                            .then(Activity => {
                                socket.emit('status', {success: true, hash: hash, status: Activity.status});
                            })
                            .catch(() => {
                                socket.emit('status', {success: false, hash: hash});
                            })
                        ;
                    });
                    socket.on('message', data => {
                        gsm.sendMessage(data.address, data.data, data.hash)
                            .then(() => {
                                data.success = true;
                                socket.emit('message', data);
                            })
                            .catch(() => {
                                data.success = false;
                                socket.emit('message', data);
                            })
                        ;
                    });
                    socket.on('dial', data => {
                        gsm.dial(data.address, data.hash)
                            .then(() => {
                                data.success = true;
                                socket.emit('dial', data);
                            })
                            .catch(() => {
                                data.success = false;
                                socket.emit('dial', data);
                            })
                        ;
                    });
                    socket.on('ussd', data => {
                        gsm.ussd(data.address, data.hash)
                            .then(() => {
                                data.success = true;
                                socket.emit('ussd', data);
                            })
                            .catch(() => {
                                data.success = false;
                                socket.emit('ussd', data);
                            })
                        ;
                    });
                });
                // state broadcast
                gsm.on('state', () => {
                    gsm.io.emit('state', {idle: gsm.idle && gsm.queueCount() === 0});
                });
            }
            let icc;
            if (this.networks.length && gsm.props.network) {
                const info = this.networks.filter(item => item.Code == gsm.props.network.code);
                if (info.length) {
                    gsm.props.network.operator = info[0].Operator;
                    gsm.props.network.country = info[0].Country;
                }
                if (gsm.props.network.country && this.icc) {
                    icc = this.getICC(gsm.props.network.country);
                    if (icc) {
                        gsm.countryCode = icc;
                    }
                }
            }
            if (!gsm.countryCode && gsm.props.smsc) {
                icc = this.splitNumber(gsm.props.smsc);
                if (icc.length === 2) {
                    gsm.countryCode = icc[0];
                }
            }
            if (gsm.countryCode) {
                console.log('%s: International Calling Code = %s', gsm.name, gsm.countryCode);
            }
            gsm.splitICC = this.splitNumber;
            if (this.uiCon) {
                this.uiCon.emit('new-terminal');
            }
        }
        return gsm;
    }

    notifyActivity(activity) {
        if (this.termCon) {
            switch (activity.type) {
                case this.Storage.ACTIVITY_RING:
                    this.termCon.to(this.ClientRoom).emit('ring', {
                        imsi: activity.imsi,
                        hash: activity.hash,
                        address: activity.address,
                        time: activity.time
                    });
                    break;
                case this.Storage.ACTIVITY_INBOX:
                    this.termCon.to(this.ClientRoom).emit('message', {
                        imsi: activity.imsi,
                        hash: activity.hash,
                        address: activity.address,
                        data: activity.data,
                        time: activity.time
                    });
                    break;
                case this.Storage.ACTIVITY_CUSD:
                    this.termCon.to(this.ClientRoom).emit('ussd', {
                        imsi: activity.imsi,
                        hash: activity.hash,
                        address: activity.address,
                        data: activity.data,
                        time: activity.time
                    });
                    break;
            }
        }
    }

    checkPendingActivity() {
        Object.keys(this.ports).forEach(portName => {
            const gsm = this.Pool.get(portName);
            if (gsm && gsm.info.imsi) {
                gsm.listMessage(AtConst.SMS_STAT_RECV_UNREAD)
                    .catch(err => console.error(err));
            }
        });
        this.Storage.getPendingActivities()
            .then(results => {
                console.log('Processing pending activity: %d', results.length);
                const q = new Queue(results, activity => {
                    this.notifyActivity(activity);
                    activity.update({status: 1})
                        .then(() => {
                            q.next();
                        })
                    ;
                });
            })
        ;
    }

    checkReport(since) {
        this.Storage.getReports(since)
            .then(results => {
                console.log('Processing report: %d', results.length);
                const q = new Queue(results, report => {
                    try {
                        this.Storage.updateReport(report.imsi, report, false, status => {
                            if (status.hash) {
                                console.log('Renotify status report: %s', status.hash);
                                if (this.termCon) {
                                    this.termCon.to(this.ClientRoom).emit('status-report', status);
                                }
                            }
                            q.next();
                        });
                    } catch (err) {
                        console.error(err);
                        q.next();
                    }
                });
            })
        ;
    }

    checkMessage(type) {
        console.log('Reading messages of type %d', type);
        Object.keys(this.ports).forEach(portName => {
            const gsm = this.Pool.get(portName);
            if (gsm && gsm.info.imsi) {
                gsm.listMessage(type);
            }
        });
    }

    detectAll() {
        const works = [];
        Object.keys(this.ports).forEach(portName => {
            let detect = true;
            if (typeof this.config.portMatcher === 'string') {
                if (!portName.match(this.config.portMatcher)) {
                    detect = false;
                }
            }
            if (detect) {
                works.push(w => new Promise((resolve, reject) => {
                    this.open(portName)
                        .then(() => resolve())
                        .catch(err => {
                            console.error(err);
                            resolve();
                        })
                    ;
                }));
            }
        });
        return Work.works(works);
    }

    detectAndNotify(socket) {
        if (!this._detecting) {
            this._detecting = true;
            this.detectAll()
                .then(() => {
                    const terminals = this.getTerminals();
                    const clients = socket ? [socket] : this.clients;
                    clients.forEach(socket => {
                        socket.emit('ready', terminals);
                    });
                })
                .catch(err => {
                    console.error('Terminal detection error: %s', err);
                })
                .finally(() => {
                    this._detecting = false;
                })
            ;
        }
    }

    getTerminals(port) {
        const terms = [];
        Object.keys(this.ports).forEach(portName => {
            const gsm = this.Pool.get(portName);
            if (gsm && gsm.info.imsi) {
                terms.push(port ? portName : gsm.info.imsi);
            }
        });
        if (port && terms.length > 1) {
            const re = /\d+/g;
            terms.sort((a, b) => {
                const ar = a.match(re);
                const br = b.match(re);
                if (ar && br) {
                    return parseInt(ar[0]) - parseInt(br[0]);
                }
                return 0;
            });
        }
        return terms;
    }

    setSocketIo(io) {
        this.io = io;
        this.uiCon = this.io.of(this.config.getPath('/ui'));
        this.uiCon.on('connection', socket => {
            console.log('UI client connected: %s', socket.id);
            socket.on('disconnect', () => {
                console.log('UI client disconnected: %s', socket.id);
            });
        });
        this.termCon = this.io.of(this.config.getPath('/ctrl'));
        this.termCon.on('connection', socket => {
            console.log('Term client connected: %s', socket.id);
            socket.time = new Date();
            const timeout = setTimeout(() => {
                console.log('Closing connection due to no auth: %s', socket.id);
                socket.disconnect();
            }, 10000);
            socket.on('disconnect', () => {
                console.log('Term client disconnected: %s', socket.id);
                socket.leave(this.ClientRoom);
                const idx = this.clients.indexOf(socket);
                if (idx >= 0) {
                    this.clients.splice(idx, 1);
                    if (this.uiCon) {
                        this.uiCon.emit('client');
                    }
                }
            });
            socket.on('auth', secret => {
                const authenticated = this.config.secret === secret;
                if (authenticated) {
                    console.log('Client is authenticated: %s', socket.id);
                    clearTimeout(timeout);
                    this.clients.push(socket);
                    socket.join(this.ClientRoom);
                    if (this.uiCon) {
                        this.uiCon.emit('client');
                    }
                } else {
                    console.log('Client is NOT authenticated: %s', socket.id);
                }
                socket.emit('auth', authenticated);
            });
            socket.on('init', () => {
                if (this.clients.indexOf(socket) >= 0) {
                    this.detectAndNotify(socket);
                }
            });
            socket.on('check-pending', () => {
                if (this.clients.indexOf(socket) >= 0) {
                    this.checkPendingActivity();
                }
            });
            socket.on('check-report', since => {
                if (this.clients.indexOf(socket) >= 0) {
                    this.checkReport(since);
                }
            });
            socket.on('check-message', type => {
                if (this.clients.indexOf(socket) >= 0) {
                    this.checkMessage(type);
                };
            });
        });
        return this;
    }

    log() {
        const args = Array.from(arguments);
        this.logger.log.apply(this.logger, args)
            .then(message => {
                if (this.uiCon) {
                    this.uiCon.emit('activity', {time: Date.now(), message: message});
                }
            })
        ;
    }
}

module.exports = new AppTerm();