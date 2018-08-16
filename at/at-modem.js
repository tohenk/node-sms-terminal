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
 * AT modem handles AT commands with underlying stream.
 */

const ntAtModem     = module.exports = exports;

const fs            = require('fs');
const path          = require('path');
const EventEmitter  = require('events');
const util          = require('util');
const ntAtDrv       = require('./at-driver');
const ntAtQueue     = require('./at-queue');
const ntUtil        = require('./../lib/util');

// factory

ntAtModem.factory = function(name, stream, config) {
    EventEmitter.call(this);
    this.config = config;
    this.name = name;
    this.logdir = this.getConfig('logdir',
        fs.realpathSync(path.join(__dirname, '..', 'logs')));
    this.logfile = path.join(this.logdir, this.name + '.log');
    this.stdout = new fs.createWriteStream(this.logfile);
    this.logger = new console.Console(this.stdout);
    this.responses = [];
    this.stream = stream;
    this.stream.on('data', (data) => {
        this.rx(data);
    });
    this.props = {};
    this.status = {};
    this.timeout = config.timeout || 5000;
    this.idle = null;
    this.detected = false;
    this.timedout = 0;
}

ntAtModem.factory.prototype.getConfig = function(name, defaultValue) {
    if (this.config && typeof this.config[name] != 'undefined') {
        return this.config[name];
    }
    return defaultValue;
}

ntAtModem.factory.prototype.useDriver = function(name) {
    var drv = ntAtDrv.get(name);
    if (typeof drv == 'undefined') {
        throw new Error('Unknown driver ' + name);
    }
    this.driver = drv;
}

ntAtModem.factory.prototype.detect = function() {
    return new Promise((resolve, reject) => {
        this.useDriver('Generic');
        this.tx('AT', {timeout: 1000}).then(() => {
            this.tx(this.getCmd(ntAtDrv.AT_CMD_Q_FRIENDLY_NAME)).then((result) => {
                var driver = ntAtDrv.match(result.res());
                if (driver.length) {
                    this.detected = true;
                    this.useDriver(driver);
                    resolve(this.driver);
                }
            }).catch(() => {
                reject(util.format('%s: modem information not available.', this.name));
            });
        }).catch(() => {
            reject(util.format('%s: not an AT modem.', this.name));
        });
    });
}

ntAtModem.factory.prototype.disconnect = function() {
    if (this.stream) {
        this.stream.close();
        this.detected = false;
    }
}

ntAtModem.factory.prototype.setState = function(state) {
    Object.assign(this.status, state);
    var isIdle = true;
    Object.values(this.status).forEach((value) => {
        if (value == true) {
            isIdle = false;
            return true;
        }
    });
    if (this.idle != isIdle) {
        this.idle = isIdle;
        const states = [];
        Object.keys(this.status).forEach((state) => {
            if (this.status[state] == true) {
                states.push(state);
            }
        });
        this.emit('state');
    }
}

ntAtModem.factory.prototype.propChanged = function(props) {
    if (typeof props == 'object') {
        Object.assign(this.props, props);
    }
    this.emit('prop');
}

ntAtModem.factory.prototype.rx = function(data) {
    if (!this.status.busy) {
        var data = ntUtil.cleanEol(data);
        this.log('RX> %s', data);
        this.recv(data);
    }
}

ntAtModem.factory.prototype.tx = function(data, options) {
    return new Promise((resolve, reject) => {
        if (data) {
            options = options || {};
            this.setState({busy: true});
            var timeout = null;
            const params = {};
            if (options.expect) params.expect = options.expect;
            if (options.ignore) params.ignore = options.ignore;
            const txd = new ntAtModem.txdata(this, params);
            const t = () => {
                this.setState({busy: false});
                this.timedout++;
                txd.timeout = true;
                reject(txd);
            }
            const f = (buffer) => {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                var buffer = ntUtil.cleanEol(buffer);
                this.log('RX> %s', buffer);
                if (txd.check(buffer)) {
                    this.setState({busy: false});
                    if (txd.okay) {
                        resolve(txd);
                    }
                    if (txd.error) {
                        reject(txd);
                    }
                    if (txd.extras) {
                        this.recv(txd.extras);
                    }
                } else {
                    timeout = setTimeout(t, options.timeout || this.timeout);
                    this.stream.once('data', f);
                }
            }
            if (this.timedout >= 100) {
                this.debug('!!! %s: Timeout threshold reached, modem may be unresponsive. Try to restart', this.name);
            }
            this.log('TX> %s', data);
            this.stream.write(data + this.getCmd(ntAtDrv.AT_PARAM_TERMINATOR), (err) => {
                if (err) {
                    this.log('ERR> %s', err.message);
                    return reject(err);
                }
                timeout = setTimeout(t, options.timeout || this.timeout);
                this.stream.once('data', f);
            });
        } else {
            reject('No data to transmit.');
        }
    });
}

ntAtModem.factory.prototype.txqueue = function(queues) {
    return new Promise((resolve, reject) => {
        const q = new ntAtQueue.queue(queues, (data) => {
            var cmd = Array.isArray(data) ? data[0] : data;
            var vars = Array.isArray(data) ? data[1] : null;
            this.tx(this.getCmd(cmd, vars)).then((res) => {
                if (!q.responses) q.responses = {};
                q.responses[cmd] = res;
                q.next();
            }).catch(() => {
                q.next();
            });
        });
        q.once('done', () => {
            resolve(q.responses);
        });
    });
}

ntAtModem.factory.prototype.recv = function(data) {
    this.responses.push(data);
    this.process();
}

ntAtModem.factory.prototype.process = function() {
    if (this.responses.length) {
        const response = this.responses.shift();
        this.emit('process', response);
    }
}

ntAtModem.factory.prototype.getCmd = function(cmd, vars) {
    var cmd = this.driver.get(cmd);
    if (typeof cmd != 'undefined') {
        // substitude character => $XX
        var match;
        while (match = cmd.match(/\$([a-zA-Z0-9]{2})/)) {
            cmd = cmd.substr(0, match.index) + String.fromCharCode(parseInt('0x' + match[1])) +
                cmd.substr(match.index + match[0].length);
        }
        // replace place holder
        var replacements = {'NONE': '', 'CR': '\r', 'LF': '\n'};
        if (vars) {
            Object.keys(vars).forEach((key) => {
                replacements[key] = vars[key];
            });
        }
        return ntUtil.trans(cmd, replacements);
    }
}

ntAtModem.factory.prototype.getResult = function(cmds, res, status) {
    var result = {};
    for (var prop in cmds) {
        var cmd = cmds[prop];
        if (res[cmd]) {
            if (typeof status != 'undefined' && status) {
                result[prop] = res[cmd].okay ? true : false;
            } else {
                result[prop] = res[cmd].res();
            }
        }
    }
    return result;
}

ntAtModem.factory.prototype.log = function() {
    var args = Array.from(arguments);
    if (args.length) {
        args[0] = ntUtil.formatDate(new Date(), 'dd-MM HH:mm:ss.zzz') + ' ' + args[0];
    }
    this.logger.log.apply(null, args);
    const message = util.format.apply(null, args);
    this.emit('log', message);
}

ntAtModem.factory.prototype.debug = function() {
    const args = Array.from(arguments);
    if (typeof this.config.logger == 'function') {
        this.config.logger.apply(null, args);
    } else {
        console.log.apply(null, args);
    }
}

util.inherits(ntAtModem.factory, EventEmitter);

// txdata

ntAtModem.txdata = function(parent, options) {
    options = options || {};
    this.parent = parent;
    this.expect = options.expect || null;
    this.ignore = options.ignore || null;
    this.okay = false;
    this.error = false;
    this.timeout = false;
    this.responses = [];
    this.extras = null;
}

ntAtModem.txdata.prototype.check = function(response) {
    var result = false;
    this.extras = null;
    this.excludeMatch = true;
    const responses = [];
    Array.prototype.push.apply(responses, this.responses);
    Array.prototype.push.apply(responses,
        this.clean(response.split(this.parent.getCmd(ntAtDrv.AT_PARAM_TERMINATOR))));
    if (!result && this.isExpected(responses)) {
        result = true;
    }
    if (!result && this.isOkay(responses)) {
        result = true;
    }
    if (!result && this.isError(responses)) {
        result = true;
    }
    this.collect(responses);
    return result;
}

ntAtModem.txdata.prototype.clean = function(responses) {
    var index = responses.length;
    while (index >= 0) {
        index--;
        if ('' == responses[index]) responses.splice(index, 1);
    }
    return responses;
}

ntAtModem.txdata.prototype.collect = function(responses) {
    this.responses = [];
    var i = 0, j = responses.length;
    while (true) {
        if (i >= j) break;
        var s = responses.shift();
        if (i == this.match.pos) {
            if (this.excludeMatch) break;
        }
        if (!this.isIgnored(s)) this.responses.push(s);
        if (i == this.match.pos) break;
        i++;
    }
    if (responses.length) {
        this.extras = responses.join(this.parent.getCmd(ntAtDrv.AT_PARAM_TERMINATOR));
    }
}

ntAtModem.txdata.prototype.getMatch = function(responses, matches, raw) {
    this.match = {};
    raw = typeof raw !== 'undefined' ? raw : false;
    var pos = 0;
    while (true) {
        if (pos >= responses.length) break;
        for (var i = 0; i < matches.length; i++) {
            var expected = raw ? matches[i] : this.parent.getCmd(matches[i]);
            if (expected == undefined) continue;
            if (this.tryMatch(responses, pos, expected)) {
                this.match.pos = pos;
                this.match.matched = matches[i];
                return true;
            }
        }
        pos++;
    }
    return false;
}

ntAtModem.txdata.prototype.tryMatch = function(responses, pos, expected) {
    if (pos < responses.length) {
        var s = responses[pos];
        // check for whole match
        if (this.matchRaw(expected, s)) {
            return true;
        }
        // check for multiline match
        if (0 === expected.indexOf(s) && ((pos + 1) < responses.length)) {
            var i = pos + 1;
            var matched = false;
            while (true) {
                if (i >= responses.length) break;
                s += responses[i];
                if (this.matchRaw(expected, s)) {
                    matched = true;
                    break;
                }
                i++;
            }
            if (matched) {
                // combine matched response
                responses[pos] = s;
                responses.splice(pos + 1, i - pos);
                return true;
            }
        }
    }
    return false;
}

ntAtModem.txdata.prototype.isOkay = function(responses) {
    const commands = [ntAtDrv.AT_RESPONSE_OK];
    if (this.getMatch(responses, commands)) {
        this.okay = true;
    }
    return this.okay;
}

ntAtModem.txdata.prototype.isError = function(responses) {
    const commands = [ntAtDrv.AT_RESPONSE_ERROR, ntAtDrv.AT_RESPONSE_NO_CARRIER,
        ntAtDrv.AT_RESPONSE_NOT_SUPPORTED, ntAtDrv.AT_RESPONSE_CME_ERROR, ntAtDrv.AT_RESPONSE_CMS_ERROR];
    if (this.getMatch(responses, commands)) {
        if ([ntAtDrv.AT_RESPONSE_CME_ERROR, ntAtDrv.AT_RESPONSE_CMS_ERROR].indexOf(this.match.matched) >= 0) {
            this.excludeMatch = false;
        }
        this.error = true;
    }
    return this.error;
}

ntAtModem.txdata.prototype.isExpected = function(responses) {
    if (this.expect) {
        const commands = Array.isArray(this.expect) ? this.expect : [this.expect];
        if (this.getMatch(responses, commands)) {
            this.okay = true;
        }
    }
    return this.okay;
}

ntAtModem.txdata.prototype.isIgnored = function(response) {
    return this.isMatch(this.ignore, response);
}

ntAtModem.txdata.prototype.isMatch = function(value, response) {
    if (value) {
        var values = Array.isArray(value) ? value : [value];
        for (var i = 0; i < values.length; i++) {
            if (this.matchRaw(values[i], response)) {
                return true;
            }
        }
    }
}

ntAtModem.txdata.prototype.match = function(cmd, response) {
    return this.matchRaw(this.parent.getCmd(cmd), response);
}

ntAtModem.txdata.prototype.matchRaw = function(s, response) {
    if (s && response.toLowerCase().substring(0, s.length) == s.toLowerCase()) {
        return true;
    }
    return false;
}

ntAtModem.txdata.prototype.res = function() {
    return this.responses.join(' ');
}

ntAtModem.txdata.prototype.pick = function() {
    if (this.responses.length) {
        return this.responses[0];
    }
}

ntAtModem.txdata.prototype.hasResponse = function() {
    return this.responses.length ? true : false;
}
