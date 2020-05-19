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

const crypto        = require('crypto');
const fs            = require('fs');
const util          = require('util');
const moment        = require('moment');
const ntAtConst     = require('./at-const');
const { ntAtDriverConstants } = require('./at-driver');
const { ntAtModem, ntAtResponse } = require('./at-modem');
const { ntAtProcessor, ntAtProcessorData } = require('./at-processor');
const { ntAtSms, ntAtSmsMessage, ntAtSmsStatusReport } = require('./at-sms');
const ntQueue       = require('./../lib/queue');
const ntWork        = require('./../lib/work');

let msgref = 0;

/**
 * AT GSM handles send and receive text message, and other GSM functionalities.
 */
class ntAtGsm extends ntAtModem {

    constructor(name, stream, config) {
        super(name, stream, config);
        this.processor = new ntAtProcessor(this);
        this.info = {};
        this.queuing = false;
        this.messages = [];
        this.options = {
            deleteMessageOnRead: this.getConfig('deleteMessageOnRead', false),
            requestMessageStatus: this.getConfig('requestMessageStatus', true),
            requestMessageReply: this.getConfig('requestMessageReply', false),
            sendMessageAsFlash: this.getConfig('sendMessageAsFlash', false),
            emptyWhenFull: this.getConfig('emptyWhenFull', false)
        }
        this.sendTimeout = config.sendTimeout || 30000; // 30 seconds
        this.monitorInterval = config.monitorInterval || 600000; // 10 minutes
        this.on('process', (response) => {
            this.doProcess(response);
        });
        this.on('prop', () => {
            this.processProps();
        });
        this.on('state', () => {
            if (this.idle) {
                if (this.memfull && !this.memfullProcessing) {
                    this.memfullProcessing = true;
                    try {
                        if (this.options.emptyWhenFull) {
                            this.debug('!! %s: Emptying full storage %s', this.name, this.memfull);
                            this.emptyStorage(this.memfull).then(() => {
                                this.memfull = null;
                            });
                        } else {
                            this.debug('!! %s: ATTENTION, storage %s is full', this.name, this.memfull);
                            this.memfull = null;
                        }
                    }
                    catch (e) {
                        console.log(e);
                    }
                    this.memfullProcessing = false;
                } else {
                    this.checkQueues();
                }
            }
        });
    }

    initialize() {
        return ntWork.works([
            () => this.doInitialize(),
            () => this.doQueryInfo(),
            () => this.getCharset(),
            () => this.getSmsMode(),
            () => this.applyDefaultStorage(),
            () => this.getSMSC(),
            () => this.getNetwork(),
            () => this.attachSignalMonitor(),
            () => this.attachMemfullMonitor()
        ]);
    }

    doInitialize() {
        const queues = [ntAtDriverConstants.AT_CMD_INIT];
        for (var i = 1; i < 10; i++) {
            queues.push(ntAtDriverConstants.AT_CMD_INIT + i.toString());
        }
        return this.txqueue(queues);
    }

    doQueryInfo() {
        return new Promise((resolve, reject) => {
            this.txqueue([
                // information
                ntAtDriverConstants.AT_CMD_Q_FRIENDLY_NAME, ntAtDriverConstants.AT_CMD_Q_MANUFACTURER, ntAtDriverConstants.AT_CMD_Q_MODEL,
                ntAtDriverConstants.AT_CMD_Q_VERSION, ntAtDriverConstants.AT_CMD_Q_IMEI, ntAtDriverConstants.AT_CMD_Q_IMSI,
                // features
                ntAtDriverConstants.AT_CMD_CALL_MONITOR, ntAtDriverConstants.AT_CMD_SMS_MONITOR, ntAtDriverConstants.AT_CMD_USSD_SET,
                // charsets
                ntAtDriverConstants.AT_CMD_CHARSET_LIST
            ]).then((res) => {
                Object.assign(this.info, this.getResult({
                    friendlyName: ntAtDriverConstants.AT_CMD_Q_FRIENDLY_NAME,
                    manufacturer: ntAtDriverConstants.AT_CMD_Q_MANUFACTURER,
                    model: ntAtDriverConstants.AT_CMD_Q_MODEL,
                    version: ntAtDriverConstants.AT_CMD_Q_VERSION,
                    serial: ntAtDriverConstants.AT_CMD_Q_IMEI,
                    imsi: ntAtDriverConstants.AT_CMD_Q_IMSI}, res));
                Object.assign(this.info, this.getResult({
                    hasCall: ntAtDriverConstants.AT_CMD_CALL_MONITOR,
                    hasSms: ntAtDriverConstants.AT_CMD_SMS_MONITOR,
                    hasUssd: ntAtDriverConstants.AT_CMD_USSD_SET}, res, true));
                if (res[ntAtDriverConstants.AT_CMD_CHARSET_LIST] && res[ntAtDriverConstants.AT_CMD_CHARSET_LIST].hasResponse()) {
                    this.doProcess(res[ntAtDriverConstants.AT_CMD_CHARSET_LIST].responses);
                }
                resolve();
            }).catch(() => {
                reject();
            });
        });
    }

    attachMonitor(title, command, handler, interval) {
        return new Promise((resolve, reject) => {
            const cmd = this.getCmd(command);
            if (!cmd) {
                this.debug('%s: %s monitor enabled', this.name, title);
                const ms = interval || this.monitorInterval;
                setInterval(handler, ms);
            } else {
                this.debug('%s: %s monitor not enabled', this.name, title);
            }
            resolve();
        });
    }

    attachSignalMonitor() {
        return this.attachMonitor('CSQ', ntAtDriverConstants.AT_RESPONSE_RSSI, () => {
            const queues = [{
                op: 'command',
                data: this.getCmd(ntAtDriverConstants.AT_CMD_CSQ)
            }];
            this.propChanged({queues: queues});
        });
    }

    attachMemfullMonitor() {
        return this.attachMonitor('MEMFULL', ntAtDriverConstants.AT_RESPONSE_MEM_FULL, () => {
            if (!this.memfullProcessing) {
                const queues = [{
                    op: 'command',
                    data: this.getCmd(ntAtDriverConstants.AT_CMD_SMS_STORAGE_GET)
                }];
                this.propChanged({queues: queues});
            }
        });
    }

    doProcess(response) {
        if (response) {
            this.setState({processing: true});
            try {
                let data = new ntAtProcessorData(this, response);
                this.processor.process(data);
                if (data.unprocessed && data.unprocessed.length) {
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

    resolveUnprocessed(data) {
        var result, resolved, len, response;
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
                            len = j - i;
                            break;
                        }
                    }
                }
            }
            if (resolved != undefined) break;
        }
        if (resolved != undefined) {
            unprocessed[resolved] = response;
            if (len > 0) {
                unprocessed.splice(resolved + 1, len);
            }
            var nextdata = new ntAtProcessor.rxdata(this, unprocessed);
            this.processor.process(nextdata);
            if (nextdata.result) {
                result = nextdata;
                this.debug('%s: Unprocessed resolved %s', this.name, JSON.stringify(nextdata.result));
            }
            if (nextdata.unprocessed && nextdata.unprocessed.length && nextdata.index > 0) {
                nextdata.unprocessed.splice(0, nextdata.index + 1);
            }
            this.saveUnprocessed(nextdata.unprocessed);
        } else {
            this.saveUnprocessed(unprocessed);
        }
        return result;
    }

    saveUnprocessed(data) {
        this.unprocessed = data;
        if (Array.isArray(this.unprocessed)) {
            this.unprocessed.forEach((s) => {
                this.debug('! %s: [%s]', this.name, s);
            });
        }
    }

    processProps() {
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
        if (this.props.storages && !this.props.memfull) {
            Object.keys(this.props.storages).every((storage) => {
                if (this.props.storages[storage].used == this.props.storages[storage].total) {
                    this.props.memfull = storage;
                    return false;
                } else {
                    return true;
                }
            });
            delete this.props.storages;
        }
        if (this.props.memfull) {
            if (this.memfull != this.props.memfull) {
                this.memfull = this.props.memfull;
                this.debug('%s: Storage %s is full', this.name, this.memfull);
            }
            delete this.props.memfull;
        }
    }

    addQueues(queues) {
        if (!this.q) {
            const next = (success) => {
                this.debug('%s: Queue %s [%s]', this.name, JSON.stringify(this.queue), success ? 'OK' : 'FAILED');
                this.queue = null;
                this.q.pending = false;
                this.q.next();
            }
            this.q = new ntQueue(queues, (queue) => {
                this.q.pending = true;
                this.queue = queue;
                switch (queue.op) {
                    case 'read':
                        this.setStorage(queue.storage).then(() => {
                            this.query(this.getCmd(ntAtDriverConstants.AT_CMD_SMS_READ, {SMS_ID: queue.index})).then(() => {
                                next(true);
                            }).catch(() => {
                                next(false);
                            });
                        }).catch(() => {
                            next(false);
                        });
                        break;
                    case 'delete':
                        this.setStorage(queue.storage).then(() => {
                            this.query(this.getCmd(ntAtDriverConstants.AT_CMD_SMS_DELETE, {SMS_ID: queue.index})).then(() => {
                                next(true);
                            }).catch(() => {
                                next(false);
                            });
                        }).catch(() => {
                            next(false);
                        });
                        break;
                    case 'command':
                        this.query(queue.data, queue.options).then(() => {
                            next(true);
                        }).catch(() => {
                            next(false);
                        });
                        break;
                    default:
                        this.debug('%s: Unknown operation %s', this.name, queue.op);
                        next(false);
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

    checkQueues() {
        if (this.q) {
            this.q.next();
        }
    }

    queueCount() {
        if (this.q) {
            return this.q.queues.length;
        }
        return 0;
    }

    dispatchMessages() {
        var index = 0;
        while (this.messages.length) {
            var nextIndex = null;
            var report = false;
            var msg = this.messages[index].message;
            if (msg instanceof ntAtSmsStatusReport) {
                report = true;
                nextIndex = this.processReport(index, msg);
            }
            if (msg instanceof ntAtSmsMessage) {
                nextIndex = this.processSMS(index, msg);
            }
            if (nextIndex != null) {
                var indexes = Array.isArray(nextIndex) ? nextIndex : [nextIndex];
                var queues = [];
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
                index++;
            }
            if (index >= this.messages.length) {
                break;
            }
        }
    }

    processReport(pos, msg) {
        this.emit('status-report', msg);
        return pos;
    }

    processSMS(pos, msg) {
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
                    if (!(nmsg instanceof ntAtSmsMessage)) continue;
                    // record non long messages in case the messages parts is still missing
                    if (nextPos == null && nmsg.getReference() == null) {
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
                if (nextPos != null) {
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

    getMessageReference() {
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

    getHash() {
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

    localizeNumber(phoneNumber) {
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

    intlNumber(phoneNumber) {
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

    encodeUssd(enc, value) {
        switch (enc) {
            case ntAtConst.USSD_ENC_7BIT:
                return ntAtSms.gsmEncode7Bit(value);
            case ntAtConst.USSD_ENC_UCS2:
                return ntAtSms.gsmEncodeUcs2(value);
        }
        return value;
    }

    decodeUssd(enc, value) {
        switch (enc) {
            case ntAtConst.USSD_ENC_7BIT:
                return ntAtSms.gsmDecode7Bit(value);
            case ntAtConst.USSD_ENC_UCS2:
                return ntAtSms.gsmDecodeUcs2(value);
        }
        return value;
    }

    query(cmd, options) {
        return new Promise((resolve, reject) => {
            if (this.queuing) {
                this.queuing = false;
                const queues = [{
                    op: 'command',
                    data: cmd,
                    options: options
                }];
                this.propChanged({queues: queues});
                resolve();
            } else {
                options = options || {};
                const storage = this.saveStorage(cmd);
                this.tx(cmd, options).then((res) => {
                    if (Object.keys(storage).length) {
                        Object.assign(this.props, storage);
                        this.debug('%s: Updating storage information from "%s"', this.name, JSON.stringify(storage));
                    }
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
                    var msg = err;
                    if (err instanceof ntAtResponse) {
                        if (err.timeout) {
                            msg = util.format('%s: Operation timeout', err.data);
                        }
                        if (err.error && err.hasResponse()) {
                            msg = util.format('%s: %s', err.data, err.res());
                        } else {
                            msg = util.format('%s: Operation failed', err.data);
                        }
                    }
                    reject(new Error(util.format('%s: %s', this.name, msg)));
                });
            }
        });
    }

    asQueue() {
        this.queuing = true;
        return this;
    }

    findMatchedCommand(data, cmd, patterns) {
        const vars = {};
        Object.keys(patterns).forEach((key) => {
            vars[key] = '_' + key + '_';
        });
        const f = (str, search, replace) => {
            return str.replace(search, replace);
        }
        var str = this.getCmd(cmd, vars);
        ['+', '='].forEach((escape) => {
            str = f(str, escape, '\\' + escape);
        });
        Object.keys(patterns).forEach((key) => {
            str = f(str, '_' + key + '_', patterns[key]);
        });
        const re = new RegExp(str);
        var match;
        if (match = re.exec(data)) {
            return match[1];
        }
    }

    saveStorage(cmd) {
        const result = {};
        const storage = this.findMatchedCommand(cmd, ntAtDriverConstants.AT_CMD_SMS_STORAGE_SET, {STORAGE: '([A-Z]+)'});
        if (storage != undefined) {
            result.storage = storage;
        }
        const storageIndex = this.findMatchedCommand(cmd, ntAtDriverConstants.AT_CMD_SMS_READ, {SMS_ID: '(\\d+)'});
        if (storageIndex != undefined) {
            result.storageIndex = parseInt(storageIndex);
        }
        return result;
    }

    sendPDU(phoneNumber, message, hash) {
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
            var msg = new ntAtSmsMessage();
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
            this.query(this.getCmd(ntAtDriverConstants.AT_CMD_SMS_MODE_SET, {SMS_MODE: ntAtConst.SMS_MODE_PDU}))
                .then(() => {
                    const works = [];
                    const prompt = this.getCmd(ntAtDriverConstants.AT_RESPONSE_SMS_PROMPT);
                    const waitPrompt = 1 == parseInt(this.getCmd(ntAtDriverConstants.AT_PARAM_SMS_WAIT_PROMPT)) ? true : false;
                    queues.forEach((msg) => {
                        const params = {
                            SMS_LEN: msg.tplen,
                            MESSAGE: msg.pdu,
                            COMMIT: this.getCmd(ntAtDriverConstants.AT_PARAM_SMS_COMMIT)
                        }
                        if (waitPrompt) {
                            works.push(() => {
                                return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_SMS_SEND_PDU, params), {
                                    expect: prompt
                                });
                            });
                            works.push(() => {
                                return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_SMS_SEND_COMMIT, params), {
                                    timeout: this.sendTimeout,
                                    context: msg
                                });
                            });
                        } else {
                            works.push(() => {
                                return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_SMS_SEND_PDU, params), {
                                    ignore: prompt,
                                    timeout: this.sendTimeout,
                                    context: msg
                                });
                            });
                        }
                    });
                    return ntWork.works(works);
                }).then(() => {
                    done(true);
                    resolve();
                }).catch(() => {
                    done(false);
                    reject();
                });
        });
    }

    getCharset() {
        return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_CHARSET_GET));
    }

    setCharset(charset) {
        return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_CHARSET_SET, {CHARSET: charset}));
    }

    getSmsMode() {
        return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_SMS_MODE_GET));
    }

    setStorage(storage) {
        return new Promise((resolve, reject) => {
            if (this.props.storage == storage) {
                resolve();
            } else {
                this.query(this.getCmd(ntAtDriverConstants.AT_CMD_SMS_STORAGE_SET, {STORAGE: storage})).then((res) => {
                    this.props.storage = storage;
                    resolve(res);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    getStorage(storage) {
        if (storage) {
            return new Promise((resolve, reject) => {
                this.setStorage(storage).then(() => {
                    this.query(this.getCmd(ntAtDriverConstants.AT_CMD_SMS_STORAGE_GET)).then((res) => {
                        resolve(res);
                    }).catch((err) => {
                        reject(err);
                    });
                }).catch((err) => {
                    reject(err);
                });
            });
        } else {
            return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_SMS_STORAGE_GET));
        }
    }

    emptyStorage(storage) {
        return new Promise((resolve, reject) => {
            this.getStorage(storage).then(() => {
                if (this.props.storage == storage && this.props.storageTotal) {
                    const queues = [];
                    // 1 based storage index
                    for (var i = 1; i <= this.props.storageTotal; i++) {
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

    applyDefaultStorage() {
        const storage = this.getCmd(ntAtDriverConstants.AT_PARAM_SMS_STORAGE);
        return this.getStorage(storage);
    }
    
    getSMSC() {
        return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_Q_SMSC));
    }

    getNetwork() {
        return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_NETWORK_GET));
    }

    getNetworks() {
        return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_NETWORK_LIST));
    }

    dial(phoneNumber, hash) {
        return new Promise((resolve, reject) => {
            const data = {
                hash: hash ? hash : this.getHash(this.intlNumber(phoneNumber)),
                address: phoneNumber
            }
            this.query(this.getCmd(ntAtDriverConstants.AT_CMD_DIAL, {PHONE_NUMBER: phoneNumber})).then((res) => {
                this.emit('dial', true, data);
                resolve(res);
            }).catch((err) => {
                this.emit('dial', false, data);
                reject(err);
            });
        });
    }

    answer() {
        return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_ANSWER));
    }

    hangup() {
        return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_HANGUP));
    }

    ussd(serviceCode, hash) {
        return new Promise((resolve, reject) => {
            const data = {
                hash: hash ? hash : this.getHash(serviceCode),
                address: serviceCode
            }
            this.ussdCode = serviceCode;
            const enc = parseInt(this.getCmd(ntAtDriverConstants.AT_PARAM_USSD_ENCODING));
            const params = {
                SERVICE_NUMBER: 1 == parseInt(this.getCmd(ntAtDriverConstants.AT_PARAM_USSD_ENCODED)) ?
                    this.encodeUssd(enc, serviceCode) : serviceCode,
                ENC: enc
            };
            this.query(this.getCmd(ntAtDriverConstants.AT_CMD_USSD_SEND, params)).then((res) => {
                this.emit('ussd-dial', true, data);
                resolve(res);
            }).catch((err) => {
                this.emit('ussd-dial', false, data);
                reject(err);
            });
        });
    }

    ussdCancel() {
        return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_USSD_CANCEL));
    }

    sendMessage(phoneNumber, message, hash) {
        switch (parseInt(this.getCmd(ntAtDriverConstants.AT_PARAM_SMS_MODE))) {
            case ntAtConst.SMS_MODE_PDU:
                return this.sendPDU(phoneNumber, message, hash);
                break;
            case ntAtConst.SMS_MODE_TEXT:
                throw new Error('SMS text mode is not supported.');
                break;
        }
    }

    listMessage(status) {
        return this.query(this.getCmd(ntAtDriverConstants.AT_CMD_SMS_LIST, {SMS_STAT: status}));
    }
}

module.exports = ntAtGsm;