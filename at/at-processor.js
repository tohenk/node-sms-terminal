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
                index: match.index,
                code: match.code,
                value: match.value,
                tokens: match.tokens,
                matched: match.matched
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
        if (data.unprocessed[matches[i].index] != undefined) {
            data.unprocessed.splice(matches[i].index, 1);
        }
    }
}

ntAtProcessor.factory.prototype.handler = function(data) {
    const matches = [];
    for (var i = 0; i < this.processors.length; i++) {
        var proc = this.processors[i];
        var result = data.match(proc);
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

ntAtProcessor.factory.prototype.add = function(cmd, len, separator, handler) {
    const processor = {
        cmd: cmd,
        len: len
    }
    if (typeof separator == 'function') {
        handler = separator;
        separator = null;
    }
    if (separator) processor.separator = separator;
    processor.handler = handler;
    this.processors.push(processor);
}

ntAtProcessor.factory.prototype.register = function() {
    this.add(ntAtDrv.AT_RESPONSE_CME_ERROR, 1, (data) => this.handleCME(data));
    this.add(ntAtDrv.AT_RESPONSE_CMS_ERROR, 1, (data) => this.handleCMS(data));
    this.add(ntAtDrv.AT_RESPONSE_SMSC, 2, (data) => this.handleCSCA(data));
    this.add(ntAtDrv.AT_RESPONSE_COPS, 1, (data) => this.handleCOPS(data));
    this.add(ntAtDrv.AT_RESPONSE_CSCS, 1, (data) => this.handleCSCS(data));
    this.add(ntAtDrv.AT_RESPONSE_CLCK, 1, (data) => this.handleCLCK(data));
    this.add(ntAtDrv.AT_RESPONSE_CSQ, 2, (data) => this.handleCSQ(data));
    this.add(ntAtDrv.AT_RESPONSE_RSSI, 1, (data) => this.handleRSSI(data));
    this.add(ntAtDrv.AT_RESPONSE_RING, 0, (data) => this.handleRING(data));
    this.add(ntAtDrv.AT_RESPONSE_CLIP, 1, (data) => this.handleCLIP(data));
    this.add(ntAtDrv.AT_RESPONSE_CALL_END, 1, (data) => this.handleCEND(data));
    this.add(ntAtDrv.AT_RESPONSE_NEW_MESSAGE_DIRECT, 2, (data) => this.handleCMT(data));
    this.add(ntAtDrv.AT_RESPONSE_NEW_MESSAGE, 2, (data) => this.handleCMTI(data));
    this.add(ntAtDrv.AT_RESPONSE_DELIVERY_REPORT_DIRECT, 1, (data) => this.handleCDS(data));
    this.add(ntAtDrv.AT_RESPONSE_DELIVERY_REPORT, 2, (data) => this.handleCDSI(data));
    this.add(ntAtDrv.AT_RESPONSE_CPMS, 3, (data) => this.handleCPMS(data));
    this.add(ntAtDrv.AT_RESPONSE_CMGF, 1, (data) => this.handleCMGF(data));
    this.add(ntAtDrv.AT_RESPONSE_CMGL, 4, (data) => this.handleCMGL(data));
    this.add(ntAtDrv.AT_RESPONSE_CMGR, 3, (data) => this.handleCMGR(data));
    this.add(ntAtDrv.AT_RESPONSE_CMGS, 1, (data) => this.handleCMGS(data));
    this.add(ntAtDrv.AT_RESPONSE_CUSD, 1, '\n', (data) => this.handleCUSD(data));
    this.add(ntAtDrv.AT_RESPONSE_MEM_FULL, 1, (data) => this.handleMEMFULL(data));
}

ntAtProcessor.factory.prototype.readPDU = function(data) {
    const result = [];
    const len = data.matched.len;
    var tokens, next, pdu, startIndex, processedIndex;
    var index = data.index;
    while (true) {
        if (index >= data.responses.length) break;
        startIndex = index;
        if (index == data.index) {
            tokens = data.tokens;
        } else {
            tokens = next;
        }
        if (!tokens) break;
        pdu = '';
        if (tokens.length >= len) {
            while (true) {
                index++;
                if (index >= data.responses.length) break;
                var match = data.matchAt(data.matched, index);
                if (match.matched) {
                    next = match.tokens;
                    break;
                } else {
                    pdu += data.responses[index];
                }
            }
            if (pdu.length) {
                if (processedIndex == undefined) processedIndex = startIndex;
                var msg = ntAtSMS.decode(pdu);
                var tplen = tokens[len - 1];
                this.parent.debug('%s: PDU = %s, tplen = %d, expected = %d [%s]', this.parent.name, pdu, msg.tplen, tplen,
                    msg.tplen == tplen ? 'OK' : 'SKIPPED');
                if (msg.tplen == tplen) {
                    var storage, storageIndex, storageStatus;
                    switch (data.matched.cmd) {
                        case ntAtDrv.AT_RESPONSE_DELIVERY_REPORT_DIRECT:
                            break;
                        case ntAtDrv.AT_RESPONSE_NEW_MESSAGE_DIRECT:
                            break;
                        case ntAtDrv.AT_RESPONSE_CMGR:
                            storage = this.parent.queue ? this.parent.queue.storage : this.parent.props.storage;
                            storageIndex = this.parent.queue ? this.parent.queue.index : this.parent.props.storageIndex;
                            storageStatus = tokens[0];
                            if (this.parent.queue) this.parent.queue = null;
                            break;
                        case ntAtDrv.AT_RESPONSE_CMGL:
                            storage = this.parent.props.storage;
                            storageIndex = tokens[0];
                            storageStatus = tokens[1];
                            break;
                    }
                    result.push({storage: storage, index: storageIndex, status: storageStatus, message: msg});
                }
            }
        }
    }
    if (processedIndex != undefined) {
        data.responses.splice(processedIndex, index - processedIndex + 1);
    }
    return result;
}

ntAtProcessor.factory.prototype.readStorage = function(data) {
    return {
        queues: [{
            op: 'read',
            storage: data.tokens[0],
            index: data.tokens[1]
        }]
    }
}

ntAtProcessor.factory.prototype.handleCME = function(data) {
    // +CME ERROR: 100
    return {
        cme_error: data.tokens[0]
    }
}

ntAtProcessor.factory.prototype.handleCMS = function(data) {
    // +CMS ERROR: 500
    return {
        cms_error: data.tokens[0]
    }
}

ntAtProcessor.factory.prototype.handleCSCA = function(data) {
    // +CSCA: "+628315000032",145
    return {
        smsc: data.tokens[0]
    }
}

ntAtProcessor.factory.prototype.handleCOPS = function(data) {
    // +COPS: <mode>,<format>,<oper>,<rat>
    if (!Array.isArray(data.tokens[0])) {
        return {
            network: ntAtNetwork.from(data.tokens)
        }
    } else {
        return {
            networks: ntAtNetwork.list(data.tokens)
        }
    }
}

ntAtProcessor.factory.prototype.handleCSCS = function(data) {
    // +CSCS: "GSM"
    // +CSCS: ("GSM","IRA","8859-1","UTF-8","UCS2")
    if (Array.isArray(data.tokens[0])) {
        return {
            charsets: data.tokens[0]
        }
    } else {
        return {
            charset: data.tokens[0]
        }
    }
}

ntAtProcessor.factory.prototype.handleCLCK = function(data) {
    // +CLCK: 1
    // +CLCK: ("CS","PS","..","..","..")
    if (!isNaN(data.tokens[0])) {
        return {
            keylock: data.tokens[0] == 1
        }
    } else {
        return {
            locks: data.tokens[0]
        }
    }
}

ntAtProcessor.factory.prototype.handleCSQ = function(data) {
    // +CSQ: 99,99
    // ^HCSQ:"LTE",46,36,81,14
    if (isNaN(data.tokens[0])) {
        data.tokens.shift();
    }
    return {
        rssi: data.tokens[0]
    }
}

ntAtProcessor.factory.prototype.handleRSSI = function(data) {
    // ^CRSSI: 31
    return {
        rssi: data.tokens[0]
    }
}

ntAtProcessor.factory.prototype.handleRING = function(data) {
    return {
        ringing: true
    }
}

ntAtProcessor.factory.prototype.handleCLIP = function(data) {
    // +CLIP: "+6281357909840",145,,,"Someone"
    return {
        caller: data.tokens[0]
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
    return this.readStorage(data);
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
    return this.readStorage(data);
}

ntAtProcessor.factory.prototype.handleCPMS = function(data) {
    // +CPMS: "SM",6,40,"SM",6,40,"SM",6,40
    const result = {};
    if (isNaN(data.tokens[0])) {
        result.storage = data.tokens.shift();
    }
    if (data.tokens.length >= 2) {
        var value = data.tokens.shift();
        if (!isNaN(value)) result.storageUsed = value;
        var value = data.tokens.shift();
        if (!isNaN(value)) result.storageTotal = value;
    }
    return result;
}

ntAtProcessor.factory.prototype.handleCMGF = function(data) {
    // +CMGF: 0
    return {
        smsMode: data.tokens[0]
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
        messageReference: data.tokens[0]
    }
}

ntAtProcessor.factory.prototype.handleCUSD = function(data) {
    // +CUSD: 1
    // +CUSD: (0-2)
    // +CUSD: 0,<str>,<dcs>
    if (data.tokens.length >= 3) {
        // 0 -> code, 1 -> data, 2 -> dcs
        const enc = data.tokens[2];
        var message = data.tokens[1];
        if (parseInt(this.parent.getCmd(ntAtDrv.AT_PARAM_USSD_ENCODING)) != enc ||
            1 == parseInt(this.parent.getCmd(ntAtDrv.AT_PARAM_USSD_ENCODED)) ||
            1 == parseInt(this.parent.getCmd(ntAtDrv.AT_PARAM_USSD_RESPONSE_ENCODED))) {
            message = this.parent.decodeUssd(enc, message);
        }
        return {
            ussd: {
                code: data.tokens[0],
                message: message
            }
        }
    } else if (!isNaN(data.tokens[0])) {
        return {
            ussd: {
                code: data.tokens[0]
            }
        }
    }
}

ntAtProcessor.factory.prototype.handleMEMFULL = function(data) {
    // ^SMMEMFULL: "SM"
    return {
        memfull: data.tokens[0]
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

ntAtProcessor.rxdata.prototype.match = function(processor) {
    var i = 0;
    while (true) {
        if (i == this.responses.length) break;
        var result = this.matchAt(processor, i);
        if (result.matched) {
            return result;
        }
        i++;
    }
}

ntAtProcessor.rxdata.prototype.matchAt = function(processor, index) {
    const result = {};
    if (index < this.responses.length) {
        const command = this.parent.getCmd(processor.cmd);
        const response = this.responses[index];
        if (this.isMatch(command, response)) {
            var value = null, tokens = null;
            var found = processor.len == 0 ? true : false; 
            if (!found) {
                value = response.substring(command.length).trimLeft();
                if (value.length) {
                    var okay;
                    var nextIndex = index;
                    while (true) {
                        if (nextIndex >= this.responses.length) break;
                        if (nextIndex > index) {
                            if (processor.separator) value += processor.separator;
                            value += this.responses[nextIndex];
                        }
                        okay = true;
                        try {
                            tokens = token.split(value, {throwError: true});
                        }
                        catch (e) {
                            okay = false;
                        }
                        if (okay && tokens.length >= processor.len) {
                            found = true;
                        }
                        if (found) {
                            break;
                        } else {
                            nextIndex++;
                        }
                    }
                    if (found && nextIndex > index) {
                        this.responses.splice(nextIndex, nextIndex - index);
                    }
                }
            }
            if (found) {
                result.index = index;
                result.code = command;
                result.value = value;
                result.tokens = tokens;
                result.matched = processor;
            }
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
