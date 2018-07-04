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

/*
 * AT GSM handles send and receive text message, and other GSM functionalities.
 */

const ntAtGsm       = module.exports = exports;

const crypto        = require('crypto');
const fs            = require('fs');
const util          = require('util');
const moment        = require('moment');
const ntAtDrv       = require('./at-driver');
const ntAtModem     = require('./at-modem');
const ntAtProcessor = require('./at-processor');
const ntAtQueue     = require('./at-queue');
const ntAtConst     = require('./at-const');
const ntAtSms       = require('./at-sms');
const ntAtSmsUtil   = require('./at-smsutil');

var msgref = 0;

ntAtGsm.factory = function(name, stream, config) {
    ntAtModem.factory.call(this, name, stream, config);
    this.processor = new ntAtProcessor.factory(this);
    this.info = {};
    this.messages = [];
    this.options = {
        deleteMessageOnRead: this.getConfig('deleteMessageOnRead', false),
        requestMessageStatus: this.getConfig('requestMessageStatus', true),
        requestMessageReply: this.getConfig('requestMessageReply', false),
        sendMessageAsFlash: this.getConfig('sendMessageAsFlash', false),
        emptyWhenFull: this.getConfig('emptyWhenFull', false)
    }
    this.sendTimeout = config.sendTimeout || 10000;
    this.on('process', (response) => {
        this.doProcess(response);
    });
    this.on('prop', () => {
        this.processProps();
    });
    this.on('state', () => {
        if (this.idle) {
            if (this.memfull && this.options.emptyWhenFull) {
                this.debug('!! %s: Emptying full storage %s', this.name, this.memfull);
                this.emptyStorage(this.memfull).then(() => {
                    this.memfull = null;
                });
            } else {
                this.checkQueues();
            }
        }
    });
}

util.inherits(ntAtGsm.factory, ntAtModem.factory);

ntAtGsm.factory.prototype.initialize = function() {
    return ntAtQueue.works([
        () => this.doInitialize(),
        () => this.doQueryInfo(),
        () => this.getCharset(),
        () => this.getSmsMode(),
        () => this.applyDefaultStorage(),
        () => this.getSMSC(),
        () => this.getNetwork(),
        () => this.attachSignalMonitor()
    ]);
}

ntAtGsm.factory.prototype.doInitialize = function() {
    const queues = [ntAtDrv.AT_CMD_INIT];
    for (var i = 1; i < 10; i++) {
        queues.push(ntAtDrv.AT_CMD_INIT + i.toString());
    }
    return this.txqueue(queues);
}

ntAtGsm.factory.prototype.doQueryInfo = function() {
    return new Promise((resolve, reject) => {
        this.txqueue([
            // information
            ntAtDrv.AT_CMD_Q_FRIENDLY_NAME, ntAtDrv.AT_CMD_Q_MANUFACTURER, ntAtDrv.AT_CMD_Q_MODEL,
            ntAtDrv.AT_CMD_Q_VERSION, ntAtDrv.AT_CMD_Q_IMEI, ntAtDrv.AT_CMD_Q_IMSI,
            // features
            ntAtDrv.AT_CMD_CALL_MONITOR, ntAtDrv.AT_CMD_SMS_MONITOR, ntAtDrv.AT_CMD_USSD_SET,
            // charsets
            ntAtDrv.AT_CMD_CHARSET_LIST
        ]).then((res) => {
            Object.assign(this.info, this.getResult({
                friendlyName: ntAtDrv.AT_CMD_Q_FRIENDLY_NAME,
                manufacturer: ntAtDrv.AT_CMD_Q_MANUFACTURER,
                model: ntAtDrv.AT_CMD_Q_MODEL,
                version: ntAtDrv.AT_CMD_Q_VERSION,
                serial: ntAtDrv.AT_CMD_Q_IMEI,
                imsi: ntAtDrv.AT_CMD_Q_IMSI}, res));
            Object.assign(this.info, this.getResult({
                hasCall: ntAtDrv.AT_CMD_CALL_MONITOR,
                hasSms: ntAtDrv.AT_CMD_SMS_MONITOR,
                hasUssd: ntAtDrv.AT_CMD_USSD_SET}, res, true));
            if (res[ntAtDrv.AT_CMD_CHARSET_LIST] && res[ntAtDrv.AT_CMD_CHARSET_LIST].hasResponse()) {
                this.doProcess(res[ntAtDrv.AT_CMD_CHARSET_LIST].responses);
            }
            resolve();
        }).catch(() => {
            reject();
        });
    });
}

ntAtGsm.factory.prototype.attachSignalMonitor = function() {
    return new Promise((resolve, reject) => {
        const cmd = this.getCmd(ntAtDrv.AT_RESPONSE_RSSI);
        if (!cmd) {
            this.debug('%s: CSQ monitor enabled', this.name);
            const interval = 5 * 60 * 1000;
            setInterval(() => {
                const queues = [{
                    op: 'command',
                    data: this.getCmd(ntAtDrv.AT_CMD_CSQ)
                }];
                this.propChanged({queues: queues});
            }, interval);
        } else {
            this.debug('%s: CSQ monitor not enabled', this.name);
        }
        resolve();
    });
}

ntAtGsm.factory.prototype.doProcess = function(response) {
    if (response) {
        this.setState({processing: true});
        try {
            // reprocess incomplete ussd
            if (this.props.ussd && this.props.ussd.wait && !Array.isArray(response)) {
                response = this.props.ussd.data + response;
            }
            var data = new ntAtProcessor.rxdata(this, response);
            this.processor.process(data);
            // check for ussd completion
            if (this.props.ussd && this.props.ussd.wait) {
                this.props.ussd.data = data.code + data.value;
                this.debug('!! %s: Waiting USSD response to complete', this.name);
            } else if (data.unprocessed) {
                // in some case, on WAVECOM modem, sometime response is not properly
                // returned in one line
                const nextdata = this.resolveUnprocessed(data);
                if (nextdata) {
                    data = nextdata;
                }
            }
        } catch (e) {
            this.debug('!!! %s: %s', this.name, e.message);
        }
        this.setState({processing: false});
        return data;
    }
}

ntAtGsm.factory.prototype.resolveUnprocessed = function(data) {
    var result;
    var resolved;
    var len;
    var response;
    const unprocessed = Array.isArray(this.unprocessed) ? this.unprocessed : [];
    Array.prototype.push.apply(unprocessed, data.unprocessed);
    for (var i = 0; i < unprocessed.length; i++) {
        response = unprocessed[i];
        if (i + 1 < unprocessed.length) {
            for (var j = i + 1; j < unprocessed.length; j++) {
                response += unprocessed[j];
                if (response.length) {
                    var nextdata = new ntAtProcessor.rxdata(this, response);
                    var handler = this.processor.handler(nextdata);
                    if (handler.length) {
                        resolved = i;
                        len = j - 1;
                        break;
                    }
                }
            }
        }
        if (resolved) break;
    }
    if (resolved != undefined) {
        unprocessed[resolved] = response;
        unprocessed.splice(resolved + 1, len);
        var nextdata = new ntAtProcessor.rxdata(this, unprocessed);
        this.processor.process(nextdata);
        if (nextdata.result) {
            this.debug('%s: Unprocessed result %s', this.name, JSON.stringify(nextdata));
            result = nextdata;
        }
        if (nextdata.unprocessed && nextdata.index > 0) {
            nextdata.unprocessed.splice(0, nextdata.index + 1);
        }
        this.saveUnprocessed(nextdata.unprocessed);
    } else {
        this.saveUnprocessed(unprocessed);
    }
    return result;
}

ntAtGsm.factory.prototype.saveUnprocessed = function(data) {
    this.unprocessed = data;
    if (Array.isArray(this.unprocessed)) {
        this.unprocessed.forEach((s) => {
            this.debug('! %s: [%s]', this.name, s);
        });
    }
}

ntAtGsm.factory.prototype.processProps = function() {
    if (this.props.messages) {
        Array.prototype.push.apply(this.messages, this.props.messages);
        delete this.props.messages;
        this.dispatchMessages();
    }
    if (this.props.queues) {
        this.addQueues(this.props.queues);
        delete this.props.queues;
    }
    if (this.props.ussd && typeof this.props.ussd.wait == 'undefined') {
        this.emit('ussd', this.props.ussd);
        delete this.props.ussd;
    }
    if (typeof this.props.ringing != 'undefined') {
        if (this.props.ringing) {
            if (!this.ringCount) {
                this.ringCount = 1;
            } else {
                this.ringCount++;
            }
        } else {
            this.ringCount = 0;
            this.caller = null;
        }
        delete this.props.ringing;
    }
    if (this.props.caller) {
        if (this.caller != this.props.caller) {
            this.caller = this.props.caller;
            if (this.ringCount > 0) this.emit('ring', this.caller);
        }
        delete this.props.caller;
    }
    if (this.props.memfull) {
        if (this.memfull != this.props.memfull) {
            this.memfull = this.props.memfull;
            this.debug('%s: Storage %s is full', this.name, this.memfull);
        }
        delete this.props.memfull;
    }
}

ntAtGsm.factory.prototype.addQueues = function(queues) {
    if (!this.q) {
        const next = () => {
            this.q.pending = false;
            this.q.next();
        }
        this.q = new ntAtQueue.queue(queues, (queue) => {
            this.debug('%s: Processing queue %s', this.name, JSON.stringify(queue));
            this.q.pending = true;
            this.queue = queue;
            switch (queue.op) {
                case 'read':
                    this.setStorage(queue.storage).then(() => {
                        this.query(this.getCmd(ntAtDrv.AT_CMD_SMS_READ, {SMS_ID: queue.index})).then(() => {
                            next();
                        }).catch(() => {
                            next();
                        });
                    }).catch(() => {
                        next();
                    });
                    break;
                case 'delete':
                    this.setStorage(queue.storage).then(() => {
                        this.query(this.getCmd(ntAtDrv.AT_CMD_SMS_DELETE, {SMS_ID: queue.index})).then(() => {
                            next();
                        }).catch(() => {
                            next();
                        });
                    }).catch(() => {
                        next();
                    });
                    break;
                case 'command':
                    this.query(queue.data).then(() => {
                        next();
                    }).catch(() => {
                        next();
                    });
                    break;
                default:
                    this.debug('%s: Unknown operation %s', this.name, queue.op);
                    next();
                    break;
            }
        }, () => {
            if (!this.idle) {
                this.debug('%s: Queue operation pending because of activity', this.name);
            }
            return this.idle;
        });
    } else {
        this.q.requeue(queues);
    }
}

ntAtGsm.factory.prototype.checkQueues = function() {
    if (this.q) {
        this.q.next();
    }
}

ntAtGsm.factory.prototype.dispatchMessages = function() {
    while (this.messages.length) {
        var index = 0;
        var report = false;
        var msg = this.messages[index].message;
        if (msg instanceof ntAtSms.StatusReport) {
            report = true;
            index = this.processReport(index, msg);
        }
        if (msg instanceof ntAtSms.SMS) {
            index = this.processSMS(index, msg);
        }
        if (index != null) {
            const indexes = Array.isArray(index) ? index : [index];
            const queues = [];
            if (report || this.options.deleteMessageOnRead) {
                for (var i = 0; i < indexes.length; i++) {
                    index = indexes[i];
                    queues.push({
                        op: 'delete',
                        storage: this.messages[index].storage,
                        index: this.messages[index].index
                    });
                }
            }
            for (var i = indexes.length - 1; i >= 0; i--) {
                this.messages.splice([indexes[i]], 1);
            }
            if (queues.length) {
                this.propChanged({queues: queues});
            }
        } else {
            break;
        }
    }
}

ntAtGsm.factory.prototype.processReport = function(pos, msg) {
    this.emit('status-report', msg);
    return pos;
}

ntAtGsm.factory.prototype.processSMS = function(pos, msg) {
    var processed = false;
    var nextPos = null;
    var total = 1;
    var count = 1;
    // check for long messages
    var ref = msg.getReference();
    if (null != ref) {
        total = msg.getTotal();
        if (this.messages.length - pos > 1) {
            const parts = {};
            parts[pos] = msg;
            for (var i = pos + 1; i < this.messages.length; i++) {
                var nmsg = this.messages[i].message;
                if (!(nmsg instanceof ntAtSms.SMS)) continue;
                // record non long messages in case the messages parts is still missing
                if (!nextPos && nmsg.getReference() == null) {
                    nextPos = i;
                }
                if (nmsg.getReference() == ref) {
                    count++;
                    parts[i] = nmsg;
                }
                if (count == total) break;
            }
            // is all message parts found?
            if (count == total) {
                processed = true;
                var pos = Object.keys(parts);
                var msg = Object.values(parts).sort((a, b) => a.getIndex() - b.getIndex());
                var address = null;
                var time = null;
                var content = '';
                msg.forEach((message) => {
                    if (null == address) address = message.address;
                    if (null == time) time = message.time;
                    content += message.message;
                });
                const hash = this.getHash(time, this.intlNumber(address), content);
                msg.forEach((message) => {
                    message.hash = hash;
                });
            }
        }
    }
    if (!processed) {
        if (null == ref) {
            // always process non long messages
            processed = true;
        } else {
            // if long messages parts was still missing then process non long one
            this.debug('%s: Waiting for other messages part from %s, found %d/%d', this.name, msg.address, count, total);
            if (nextPos) {
                var msg = this.messages[nextPos].message;
                var pos = nextPos;
                processed = true;
            }
        }
    }
    if (processed) {
        // provide message hash
        if (!Array.isArray(msg)) {
            msg.hash = this.getHash(msg.time, this.intlNumber(msg.address), msg.message);
        }
        this.emit('message', msg);
    }
    return processed ? pos : null;
}

ntAtGsm.factory.prototype.getMessageReference = function() {
    var result = 0;
    if (this.msgRefFilename) {
        if (fs.existsSync(this.msgRefFilename)) {
            const ref = JSON.parse(fs.readFileSync(this.msgRefFilename));
            result = ref.msgref;
        }
        var nextRef = result;
        nextRef++;
        if (nextRef > 255) nextRef = 0;
        fs.writeFileSync(this.msgRefFilename, JSON.stringify({
            msgref: nextRef
        }));
    } else {
        result = msgref;
        msgref++;
        if (msgref > 255) msgref = 0;
    }
    return result;
}

ntAtGsm.factory.prototype.getHash = function() {
    const args = Array.from(arguments);
    var dt = new Date();
    if (args.length && args[0] instanceof Date) {
        dt = args.shift();
    }
    const values = [this.props.smsc, moment(dt).format('YYYYMMDDHHmmssSSS')];
    Array.prototype.push.apply(values, args);
    const shasum = crypto.createHash('sha1');
    shasum.update(values.join(''));
    return shasum.digest('hex');
}

ntAtGsm.factory.prototype.localizeNumber = function(phoneNumber) {
    if (phoneNumber.charAt(0) == '+') {
        if (typeof this.splitICC == 'function') {
            const icc = this.splitICC(phoneNumber);
            if (icc.length == 2) {
                phoneNumber = icc[1];
                if (phoneNumber.charAt(0) != '0') {
                    phoneNumber = '0' + phoneNumber;
                }
            }
        }
    }
    return phoneNumber;
}

ntAtGsm.factory.prototype.intlNumber = function(phoneNumber) {
    if (phoneNumber.charAt(0) == '0') {
        // get country code from SMSC
        if (!this.countryCode && typeof this.splitICC == 'function') {
            const icc = this.splitICC(this.props.smsc);
            if (icc.length == 2) {
                this.countryCode = icc[0];
            }
        }
        if (!this.countryCode) {
            throw new Error('Country code is not defined.');
        }
        phoneNumber = this.countryCode + phoneNumber.substr(1);
    }
    if (phoneNumber.charAt(0) != '+') {
        phoneNumber = '+' + phoneNumber;
    }
    return phoneNumber;
}

ntAtGsm.factory.prototype.encodeUssd = function(enc, value) {
    switch (enc) {
        case ntAtConst.USSD_ENC_7BIT:
            return ntAtSmsUtil.gsmEncode7Bit(value);
        case ntAtConst.USSD_ENC_UCS2:
            return ntAtSmsUtil.gsmEncodeUcs2(value);
    }
    return value;
}

ntAtGsm.factory.prototype.decodeUssd = function(enc, value) {
    switch (enc) {
        case ntAtConst.USSD_ENC_7BIT:
            return ntAtSmsUtil.gsmDecode7Bit(value);
        case ntAtConst.USSD_ENC_UCS2:
            return ntAtSmsUtil.gsmDecodeUcs2(value);
    }
    return value;
}

ntAtGsm.factory.prototype.query = function(cmd, options) {
    return new Promise((resolve, reject) => {
        options = options || {};
        this.tx(cmd, options).then((res) => {
            if (res.hasResponse()) {
                var data = this.doProcess(res.responses);
                if (typeof options.context == 'object' && typeof data.result == 'object') {
                    Object.assign(options.context, data.result);
                }
                resolve(data.result);
            } else {
                resolve();
            }
        }).catch((err) => {
            if (err instanceof ntAtModem.txdata) {
                if (err.timeout) {
                    reject(new Error(util.format('%s: Operation timeout', err.data)));
                }
                if (err.error && err.hasResponse()) {
                    reject(new Error(util.format('%s: %s', err.data, err.res())));
                } else {
                    reject(new Error(util.format('%s: Operation failed', err.data)));
                }
            } else {
                reject(err);
            }
        });
    });
}

ntAtGsm.factory.prototype.sendPDU = function(phoneNumber, message, hash) {
    const queues = [];
    const options = {
        requestStatus: this.options.requestMessageStatus,
        requestReply: this.options.requestMessageReply,
        flashMessage: this.options.sendMessageAsFlash
    }
    const dcs = ntAtSms.detectCodingScheme(message);
    const messages = ntAtSms.smsSplit(dcs, message);
    var index = 0;
    var reference = messages.length > 1 ? this.getMessageReference() : null;
    for (var index = 0; index < messages.length; index++) {
        var msg = new ntAtSms.SMS();
        msg.dcs = dcs;
        msg.address = phoneNumber;
        if (messages.length > 1) {
            msg.udhi = {
                reference: reference,
                total: messages.length,
                index: index + 1
            }
        }
        if (!msg.encodeMessage(messages[index], options)) {
            throw new Error(util.format('%s: Message "%s" can\'t be sent.', this.name, messages[index]));
        }
        if (!hash) {
            // generated hash is for the whole message
            hash = this.getHash(msg.time, this.intlNumber(phoneNumber), message);
        }
        msg.hash = hash;
        queues.push(msg);
    }
    return new Promise((resolve, reject) => {
        const done = (success) => {
            this.setState({sending: false});
            this.emit('pdu', success, queues);
        }
        this.setState({sending: true});
        this.query(this.getCmd(ntAtDrv.AT_CMD_SMS_MODE_SET, {SMS_MODE: ntAtConst.SMS_MODE_PDU}))
            .then(() => {
                const works = [];
                const prompt = this.getCmd(ntAtDrv.AT_RESPONSE_SMS_PROMPT);
                const waitPrompt = 1 == parseInt(this.getCmd(ntAtDrv.AT_PARAM_SMS_WAIT_PROMPT)) ? true : false;
                queues.forEach((msg) => {
                    const params = {
                        SMS_LEN: msg.tplen,
                        MESSAGE: msg.pdu,
                        COMMIT: this.getCmd(ntAtDrv.AT_PARAM_SMS_COMMIT)
                    }
                    if (waitPrompt) {
                        works.push(() => {
                            return this.query(this.getCmd(ntAtDrv.AT_CMD_SMS_SEND_PDU, params), {
                                expect: prompt
                            });
                        });
                        works.push(() => {
                            return this.query(this.getCmd(ntAtDrv.AT_CMD_SMS_SEND_COMMIT, params), {
                                timeout: this.sendTimeout,
                                context: msg
                            });
                        });
                    } else {
                        works.push(() => {
                            return this.query(this.getCmd(ntAtDrv.AT_CMD_SMS_SEND_PDU, params), {
                                ignore: prompt,
                                timeout: this.sendTimeout,
                                context: msg
                            });
                        });
                    }
                });
                return ntAtQueue.works(works);
            }).then(() => {
                done(true);
                resolve();
            }).catch(() => {
                done(false);
                reject();
            });
    });
}

ntAtGsm.factory.prototype.getCharset = function() {
    return this.query(this.getCmd(ntAtDrv.AT_CMD_CHARSET_GET));
}

ntAtGsm.factory.prototype.setCharset = function(charset) {
    return this.query(this.getCmd(ntAtDrv.AT_CMD_CHARSET_SET, {CHARSET: charset}));
}

ntAtGsm.factory.prototype.getSmsMode = function() {
    return this.query(this.getCmd(ntAtDrv.AT_CMD_SMS_MODE_GET));
}

ntAtGsm.factory.prototype.setStorage = function(storage) {
    return new Promise((resolve, reject) => {
        if (this.props.storage == storage) {
            resolve();
        } else {
            this.query(this.getCmd(ntAtDrv.AT_CMD_SMS_STORAGE_SET, {STORAGE: storage})).then((res) => {
                this.props.storage = storage;
                resolve(res);
            }).catch((err) => {
                reject(err);
            });
        }
    });
}

ntAtGsm.factory.prototype.getStorage = function(storage) {
    if (storage) {
        return new Promise((resolve, reject) => {
            this.setStorage(storage).then(() => {
                this.query(this.getCmd(ntAtDrv.AT_CMD_SMS_STORAGE_GET)).then((res) => {
                    resolve(res);
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
        });
    } else {
        return this.query(this.getCmd(ntAtDrv.AT_CMD_SMS_STORAGE_GET));
    }
}

ntAtGsm.factory.prototype.emptyStorage = function(storage) {
    return new Promise((resolve, reject) => {
        this.getStorage(storage).then(() => {
            if (this.props.storage == storage && this.props.storageTotal) {
                const queues = [];
                for (var i = 0; i < this.props.storageTotal; i++) {
                    queues.push({
                        op: 'delete',
                        storage: storage,
                        index: i
                    });
                }
                if (queues.length) {
                    this.propChanged({queues: queues});
                }
            }
            resolve();
        }).catch((err) => {
            reject(err);
        });
    });
}

ntAtGsm.factory.prototype.applyDefaultStorage = function() {
    const storage = this.getCmd(ntAtDrv.AT_PARAM_SMS_STORAGE);
    return this.getStorage(storage);
}

ntAtGsm.factory.prototype.getSMSC = function() {
    return this.query(this.getCmd(ntAtDrv.AT_CMD_Q_SMSC));
}

ntAtGsm.factory.prototype.getNetwork = function() {
    return this.query(this.getCmd(ntAtDrv.AT_CMD_NETWORK_GET));
}

ntAtGsm.factory.prototype.getNetworks = function() {
    return this.query(this.getCmd(ntAtDrv.AT_CMD_NETWORK_LIST));
}

ntAtGsm.factory.prototype.dial = function(phoneNumber, hash) {
    return new Promise((resolve, reject) => {
        const data = {
            hash: hash ? hash : this.getHash(this.intlNumber(phoneNumber)),
            address: phoneNumber
        }
        this.query(this.getCmd(ntAtDrv.AT_CMD_DIAL, {PHONE_NUMBER: phoneNumber})).then((res) => {
            this.emit('dial', true, data);
            resolve(res);
        }).catch((err) => {
            this.emit('dial', false, data);
            reject(err);
        });
    });
}

ntAtGsm.factory.prototype.answer = function() {
    return this.query(this.getCmd(ntAtDrv.AT_CMD_ANSWER));
}

ntAtGsm.factory.prototype.hangup = function() {
    return this.query(this.getCmd(ntAtDrv.AT_CMD_HANGUP));
}

ntAtGsm.factory.prototype.ussd = function(serviceCode, hash) {
    return new Promise((resolve, reject) => {
        const data = {
            hash: hash ? hash : this.getHash(serviceCode),
            address: serviceCode
        }
        this.ussdCode = serviceCode;
        const enc = parseInt(this.getCmd(ntAtDrv.AT_PARAM_USSD_ENCODING));
        const params = {
            SERVICE_NUMBER: 1 == parseInt(this.getCmd(ntAtDrv.AT_PARAM_USSD_ENCODED)) ?
                this.encodeUssd(enc, serviceCode) : serviceCode,
            ENC: enc
        };
        this.query(this.getCmd(ntAtDrv.AT_CMD_USSD_SEND, params)).then((res) => {
            this.emit('ussd-dial', true, data);
            resolve(res);
        }).catch((err) => {
            this.emit('ussd-dial', false, data);
            reject(err);
        });
    });
}

ntAtGsm.factory.prototype.ussdCancel = function() {
    return this.query(this.getCmd(ntAtDrv.AT_CMD_USSD_CANCEL));
}

ntAtGsm.factory.prototype.sendMessage = function(phoneNumber, message, hash) {
    switch (parseInt(this.getCmd(ntAtDrv.AT_PARAM_SMS_MODE))) {
        case ntAtConst.SMS_MODE_PDU:
            return this.sendPDU(phoneNumber, message, hash);
            break;
        case ntAtConst.SMS_MODE_TEXT:
            throw new Error('SMS text mode is not supported.');
            break;
    }
}

ntAtGsm.factory.prototype.listMessage = function(status) {
    return this.query(this.getCmd(ntAtDrv.AT_CMD_SMS_LIST, {SMS_STAT: status}));
}
