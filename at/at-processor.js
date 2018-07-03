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
 * AT GSM response processor.
 */

const ntAtProcessor = module.exports = exports;

const ntAtDrv       = require('./at-driver');
const ntAtNetwork   = require('./at-network');
const ntAtSMS       = require('./at-sms');
const token         = require('./../lib/token');

ntAtProcessor.factory = function(parent) {
    this.parent = parent;
    this.processors = [];
    this.register();
}

ntAtProcessor.factory.prototype.process = function(data) {
    const matches = this.handler(data);
    if (matches.length) {
        matches.forEach((match) => {
            Object.assign(data, {
                matched: match.matched,
                index: match.index,
                code: match.code,
                value: match.value
            });
            const result = match.handler(data);
            if (typeof result == 'object') {
                if (!data.result) {
                    data.result = {};
                }
                Object.assign(data.result, result);
                this.parent.propChanged(result);
            }
        });
    }
    data.unprocessed = data.responses;
    for (var i = matches.length - 1; i >= 0; i--) {
        if (data.unprocessed[matches[i].index]) {
            data.unprocessed.splice(matches[i].index, 1);
        }
    }
}

ntAtProcessor.factory.prototype.handler = function(data) {
    const matches = [];
    for (var i = 0; i < this.processors.length; i++) {
        var proc = this.processors[i];
        var result = data.match(proc.cmd);
        if (typeof result == 'object') {
            result.handler = proc.handler;
            matches.push(result);
        }
    }
    if (matches.length > 1) {
        matches.sort((a, b) => a.index - b.index);
    }
    return matches;
}

ntAtProcessor.factory.prototype.add = function(cmd, handler) {
    this.processors.push({
        cmd: cmd,
        handler: handler
    });
}

ntAtProcessor.factory.prototype.register = function() {
    this.add(ntAtDrv.AT_RESPONSE_CME_ERROR, (data) => this.handleCME(data));
    this.add(ntAtDrv.AT_RESPONSE_CMS_ERROR, (data) => this.handleCMS(data));
    this.add(ntAtDrv.AT_RESPONSE_SMSC, (data) => this.handleCSCA(data));
    this.add(ntAtDrv.AT_RESPONSE_COPS, (data) => this.handleCOPS(data));
    this.add(ntAtDrv.AT_RESPONSE_CSCS, (data) => this.handleCSCS(data));
    this.add(ntAtDrv.AT_RESPONSE_CLCK, (data) => this.handleCLCK(data));
    this.add(ntAtDrv.AT_RESPONSE_CSQ, (data) => this.handleCSQ(data));
    this.add(ntAtDrv.AT_RESPONSE_RSSI, (data) => this.handleRSSI(data));
    this.add(ntAtDrv.AT_RESPONSE_RING, (data) => this.handleRING(data));
    this.add(ntAtDrv.AT_RESPONSE_CLIP, (data) => this.handleCLIP(data));
    this.add(ntAtDrv.AT_RESPONSE_CALL_END, (data) => this.handleCEND(data));
    this.add(ntAtDrv.AT_RESPONSE_NEW_MESSAGE_DIRECT, (data) => this.handleCMT(data));
    this.add(ntAtDrv.AT_RESPONSE_NEW_MESSAGE, (data) => this.handleCMTI(data));
    this.add(ntAtDrv.AT_RESPONSE_DELIVERY_REPORT_DIRECT, (data) => this.handleCDS(data));
    this.add(ntAtDrv.AT_RESPONSE_DELIVERY_REPORT, (data) => this.handleCDSI(data));
    this.add(ntAtDrv.AT_RESPONSE_CPMS, (data) => this.handleCPMS(data));
    this.add(ntAtDrv.AT_RESPONSE_CMGF, (data) => this.handleCMGF(data));
    this.add(ntAtDrv.AT_RESPONSE_CMGL, (data) => this.handleCMGL(data));
    this.add(ntAtDrv.AT_RESPONSE_CMGR, (data) => this.handleCMGR(data));
    this.add(ntAtDrv.AT_RESPONSE_CMGS, (data) => this.handleCMGS(data));
    this.add(ntAtDrv.AT_RESPONSE_CUSD, (data) => this.handleCUSD(data));
    this.add(ntAtDrv.AT_RESPONSE_MEM_FULL, (data) => this.handleMEMFULL(data));
}

ntAtProcessor.factory.prototype.readPDU = function(data) {
    const result = [];
    const len = data.matched == ntAtDrv.AT_RESPONSE_CMGR ? 3 : 4;
    while (data.responses.length) {
        var header = '';
        var pdu = '';
        var tokens = [];
        // detect header
        while (true) {
            if (!data.responses.length) break;
            header += data.responses.shift();
            tokens = token.split(header.substr(data.code.length));
            if (tokens.length == len) break;
        }
        // concatenate PDU in case PDU is not in one line
        while (true) {
            if (!data.responses.length) break;
            if (data.responses[0].indexOf(data.code) == 0) break;
            pdu += data.responses.shift();
        }
        if (pdu.length && tokens.length == len) {
            var msg = ntAtSMS.decode(pdu);
            var tplen = data.matched == ntAtDrv.AT_RESPONSE_CMGR ? tokens[2] : tokens[3];
            this.parent.debug('%s: PDU = %s, tplen = %d, expected = %d', this.parent.name, pdu, msg.tplen, tplen);
            if (msg && msg.tplen == tplen) {
                result.push({
                    storage: data.matched == ntAtDrv.AT_RESPONSE_CMGR ? this.parent.queue.storage :
                        this.parent.props.storage,
                    index: data.matched == ntAtDrv.AT_RESPONSE_CMGR ? this.parent.queue.index : tokens[0],
                    status: data.matched == ntAtDrv.AT_RESPONSE_CMGR ? tokens[0] : tokens[1],
                    message: msg
                });
            }
        }
    }
    return result;
}

ntAtProcessor.factory.prototype.queueReadStorage = function(data) {
    const tokens = token.split(data.value);
    if (tokens.length) {
        return {
            queues: [{
                op: 'read',
                storage: tokens[0],
                index: tokens[1]
            }]
        }
    }
}

ntAtProcessor.factory.prototype.concatUssdResponse = function(data, callback) {
    var response = data.value;
    var index = data.index;
    // concat responses
    while (true) {
        index++;
        if (index == data.responses.length) break;
        if (!callback(response)) break;
        response += '\r\n' + data.responses[index];
    }
    // remove already concatenated response
    while (index > data.index) {
        data.responses.splice(index, 1);
        index--;
    }
    data.value = response;
}

ntAtProcessor.factory.prototype.findUssdQuote = function(data) {
    const firstQuote = data.value.indexOf('"');
    if (firstQuote >= 0) {
        this.concatUssdResponse(data, (res) => {
            return res.lastIndexOf('"') == firstQuote;
        });
        // check if USSD response is complete
        return data.value.lastIndexOf('"') > firstQuote ? false : true;
    }
}

ntAtProcessor.factory.prototype.fixUssdResponse = function(data) {
    var quoted = this.findUssdQuote(data);
    if (quoted != undefined) return quoted;
    // in some case, the quote go beyond next line
    if (data.value.substr(-1) == ',') {
        this.concatUssdResponse(data, (res) => {
            return res.indexOf('"') < 0;
        });
        var quoted = this.findUssdQuote(data);
        if (quoted != undefined) return quoted;
    }
    return false;
}

ntAtProcessor.factory.prototype.handleCME = function(data) {
    // +CME ERROR: 100
    return {
        cme_error: parseInt(data.value)
    }
}

ntAtProcessor.factory.prototype.handleCMS = function(data) {
    // +CMS ERROR: 500
    return {
        cms_error: parseInt(data.value)
    }
}

ntAtProcessor.factory.prototype.handleCSCA = function(data) {
    // +CSCA: "+628315000032",145
    const tokens = token.split(data.value);
    if (tokens.length) {
        return {
            smsc: tokens[0]
        }
    }
}

ntAtProcessor.factory.prototype.handleCOPS = function(data) {
    // +COPS: <mode>,<format>,<oper>,<rat>
    const tokens = token.split(data.value);
    if (tokens.length) {
        if (!Array.isArray(tokens[0])) {
            return {
                network: ntAtNetwork.from(tokens)
            }
        } else {
            return {
                networks: ntAtNetwork.list(tokens)
            }
        }
    }
}

ntAtProcessor.factory.prototype.handleCSCS = function(data) {
    // +CSCS: "GSM"
    // +CSCS: ("GSM","IRA","8859-1","UTF-8","UCS2")
    const tokens = token.split(data.value);
    if (tokens.length) {
        if (Array.isArray(tokens[0])) {
            return {
                charsets: tokens[0]
            }
        } else {
            return {
                charset: tokens[0]
            }
        }
    }
}

ntAtProcessor.factory.prototype.handleCLCK = function(data) {
    // +CLCK: 1
    // +CLCK: ("CS","PS","..","..","..")
    const tokens = token.split(data.value);
    if (tokens.length) {
        if (!isNaN(tokens[0])) {
            return {
                keylock: tokens[0] == 1
            }
        } else {
            return {
                locks: tokens[0]
            }
        }
    }
}

ntAtProcessor.factory.prototype.handleCSQ = function(data) {
    // +CSQ: 99,99
    // ^HCSQ:"LTE",46,36,81,14
    const tokens = token.split(data.value);
    if (tokens.length) {
        if (isNaN(tokens[0])) {
            tokens.shift();
        }
        return {
            rssi: parseInt(tokens[0])
        }
    }
}

ntAtProcessor.factory.prototype.handleRSSI = function(data) {
    // ^CRSSI: 31
    if (!isNaN(data.value)) {
        return {
            rssi: parseInt(data.value)
        }
    }
}

ntAtProcessor.factory.prototype.handleRING = function(data) {
    return {
        ringing: true
    }
}

ntAtProcessor.factory.prototype.handleCLIP = function(data) {
    // +CLIP: "+6281357909840",145,,,"Someone"
    const tokens = token.split(data.value);
    if (tokens.length) {
        return {
            caller: tokens[0]
        }
    }
}

ntAtProcessor.factory.prototype.handleCEND = function(data) {
    // ^CEND: <no>,<duration>,<status>,<cause>
    return {
        ringing: false
    }
}

ntAtProcessor.factory.prototype.handleCMT = function(data) {
    const result = this.readPDU(data);
    if (result.length) {
        return {
            messages: result
        }
    }
}

ntAtProcessor.factory.prototype.handleCMTI = function(data) {
    // +CMTI: "ME",268516608
    return this.queueReadStorage(data);
}

ntAtProcessor.factory.prototype.handleCDS = function(data) {
    const result = this.readPDU(data);
    if (result.length) {
        return {
            messages: result
        }
    }
}

ntAtProcessor.factory.prototype.handleCDSI = function(data) {
    return this.queueReadStorage(data);
}

ntAtProcessor.factory.prototype.handleCPMS = function(data) {
    // +CPMS: "SM",6,40,"SM",6,40,"SM",6,40
    const tokens = token.split(data.value);
    if (tokens.length) {
        const result = {};
        if (isNaN(tokens[0])) {
            result.storage = tokens[0];
        }
        if (tokens.length > 1 && !isNaN(tokens[1])) {
            result.storageUsed = parseInt(tokens[1]);
        }
        if (tokens.length > 2 && !isNaN(tokens[2])) {
            result.storageTotal = parseInt(tokens[2]);
        }
        return result;
    }
}

ntAtProcessor.factory.prototype.handleCMGF = function(data) {
    // +CMGF: 0
    if (!isNaN(data.value)) {
        return {
            smsMode: parseInt(data.value)
        }
    }
}

ntAtProcessor.factory.prototype.handleCMGL = function(data) {
    // +CMGL: 0,0,,123
    // 0691261801000004048122550000115071015064827BD3E6140495BF410A45CC059A96E5F6F4B80C4ABACD6F85CC050AD6E96F90B40C67E71533178898B697E5749082E6020DDFF0BCA2E60209D9E1F11AC44CCFE90A9B0B7445A7E96510333DA72B14D372BB1E064D9B531039CC0EB741F3F27C9E7EBB4169771A749687E9E9B90B
    const result = this.readPDU(data);
    if (result.length) {
        return {
            messages: result
        }
    }
}

ntAtProcessor.factory.prototype.handleCMGR = function(data) {
    // +CMGR: 0,,123
    // 0691261801000004048122550000115071015064827BD3E6140495BF410A45CC059A96E5F6F4B80C4ABACD6F85CC050AD6E96F90B40C67E71533178898B697E5749082E6020DDFF0BCA2E60209D9E1F11AC44CCFE90A9B0B7445A7E96510333DA72B14D372BB1E064D9B531039CC0EB741F3F27C9E7EBB4169771A749687E9E9B90B
    const result = this.readPDU(data);
    if (result.length) {
        return {
            messages: result
        }
    }
}

ntAtProcessor.factory.prototype.handleCMGS = function(data) {
    // +CMGS: 29
    return {
        messageReference: parseInt(data.value)
    }
}

ntAtProcessor.factory.prototype.handleCUSD = function(data) {
    // +CUSD: 1
    // +CUSD: (0-2)
    // +CUSD: 0,<str>,<dcs>
    const incomplete = this.fixUssdResponse(data);
    if (incomplete) {
        return {
            ussd: {wait: true}
        }
    } else {
        const tokens = token.split(data.value);
        if (tokens.length) {
            if (tokens.length >= 3) {
                // 0 -> code, 1 -> data, 2 -> dcs
                const enc = tokens[2];
                var message = tokens[1];
                if (parseInt(this.parent.getCmd(ntAtDrv.AT_PARAM_USSD_ENCODING)) != enc ||
                    1 == parseInt(this.parent.getCmd(ntAtDrv.AT_PARAM_USSD_ENCODED)) ||
                    1 == parseInt(this.parent.getCmd(ntAtDrv.AT_PARAM_USSD_RESPONSE_ENCODED))) {
                    message = this.parent.decodeUssd(enc, message);
                }
                return {
                    ussd: {
                        code: tokens[0],
                        message: message
                    }
                }
            } else if (!isNaN(tokens[0])) {
                return {
                    ussd: {
                        code: tokens[0]
                    }
                }
            }
        }
    }
}

ntAtProcessor.factory.prototype.handleMEMFULL = function(data) {
    // ^SMMEMFULL: "SM"
    const tokens = token.split(data.value);
    if (tokens.length) {
        return {
            memfull: tokens[0]
        }
    }
}

// rxdata

ntAtProcessor.rxdata = function(parent, response) {
    this.parent = parent;
    this.responses = Array.isArray(response) ? response :
        response.split(this.parent.getCmd(ntAtDrv.AT_PARAM_TERMINATOR));
    this.clean();
}

ntAtProcessor.rxdata.prototype.clean = function() {
    var index = this.responses.length;
    while (index >= 0) {
        index--;
        if ('' == this.responses[index]) this.responses.splice(index, 1);
    }
}

ntAtProcessor.rxdata.prototype.match = function(cmd) {
    for (var i = 0; i < this.responses.length; i++) {
        var result = this.matchAt(cmd, i);
        if (result.matched) {
            return result;
        }
    }
}

ntAtProcessor.rxdata.prototype.matchAt = function(cmd, index) {
    const result = {};
    if (index < this.responses.length) {
        var command = this.parent.getCmd(cmd);
        var response = this.responses[index];
        if (this.isMatch(command, response)) {
            result.index = index;
            result.matched = cmd;
            result.code = command;
            result.value = response.substring(command.length).trim();
        }
    }
    return result;
}

ntAtProcessor.rxdata.prototype.isMatch = function(command, response) {
    if (command) {
        if (response.toLowerCase().substring(0, command.length) == command.toLowerCase()) {
            return true;
        }
    }
    return false;
}
