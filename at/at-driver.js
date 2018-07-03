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
 * AT communication driver.
 */

const ntAtDriver = module.exports = exports;

const fs         = require('fs');
const ini        = require('ini');
const ntAtConst  = require('./at-const');

const Drivers    = {};

// ntAtDriver

ntAtDriver.AT_PARAM_TERMINATOR                 = 'PARAM_TERMINATOR';
ntAtDriver.AT_PARAM_DEVICE_NAME                = 'PARAM_DEVICE_NAME';
ntAtDriver.AT_PARAM_KEYPAD_CHARSET             = 'PARAM_KEYPAD_CHARSET';
ntAtDriver.AT_PARAM_SMS_MODE                   = 'PARAM_SMS_MODE';
ntAtDriver.AT_PARAM_SMS_COMMIT                 = 'PARAM_SMS_COMMIT';
ntAtDriver.AT_PARAM_SMS_CANCEL                 = 'PARAM_SMS_CANCEL';
ntAtDriver.AT_PARAM_SMS_STORAGE                = 'PARAM_SMS_STORAGE';
ntAtDriver.AT_PARAM_USSD_ENCODED               = 'PARAM_USSD_ENCODED';
ntAtDriver.AT_PARAM_USSD_ENCODING              = 'PARAM_USSD_ENCODING';
ntAtDriver.AT_PARAM_USSD_RESPONSE_ENCODED      = 'PARAM_USSD_RESPONSE_ENCODED';
ntAtDriver.AT_CMD_INIT                         = 'CMD_INIT';
ntAtDriver.AT_CMD_Q_FRIENDLY_NAME              = 'CMD_QUERY_FRIENDLY_NAME';
ntAtDriver.AT_CMD_Q_MANUFACTURER               = 'CMD_QUERY_MANUFACTURER';
ntAtDriver.AT_CMD_Q_MODEL                      = 'CMD_QUERY_MODEL';
ntAtDriver.AT_CMD_Q_VERSION                    = 'CMD_QUERY_VERSION';
ntAtDriver.AT_CMD_Q_IMEI                       = 'CMD_QUERY_IMEI';
ntAtDriver.AT_CMD_Q_IMSI                       = 'CMD_QUERY_IMSI';
ntAtDriver.AT_CMD_Q_SMSC                       = 'CMD_QUERY_SMSC';
ntAtDriver.AT_CMD_DIAL                         = 'CMD_DIAL';
ntAtDriver.AT_CMD_ANSWER                       = 'CMD_ANSWER';
ntAtDriver.AT_CMD_HANGUP                       = 'CMD_HANGUP';
ntAtDriver.AT_CMD_CALL_MONITOR                 = 'CMD_CALL_MONITOR';
ntAtDriver.AT_CMD_SMS_MONITOR                  = 'CMD_SMS_MONITOR';
ntAtDriver.AT_CMD_SMS_STORAGE_GET              = 'CMD_SMS_STORAGE_GET';
ntAtDriver.AT_CMD_SMS_STORAGE_SET              = 'CMD_SMS_STORAGE_SET';
ntAtDriver.AT_CMD_SMS_READ                     = 'CMD_SMS_READ';
ntAtDriver.AT_CMD_SMS_DELETE                   = 'CMD_SMS_DELETE';
ntAtDriver.AT_CMD_SMS_LIST                     = 'CMD_SMS_LIST';
ntAtDriver.AT_CMD_SMS_MODE_SET                 = 'CMD_SMS_MODE_SET';
ntAtDriver.AT_CMD_SMS_MODE_GET                 = 'CMD_SMS_MODE_GET';
ntAtDriver.AT_CMD_SMS_SEND_PDU                 = 'CMD_SMS_SEND_PDU';
ntAtDriver.AT_CMD_SMS_SEND_TEXT                = 'CMD_SMS_SEND_TEXT';
ntAtDriver.AT_CMD_SMS_SEND_COMMIT              = 'CMD_SMS_SEND_COMMIT';
ntAtDriver.AT_CMD_USSD_SET                     = 'CMD_USSD_SET';
ntAtDriver.AT_CMD_USSD_CANCEL                  = 'CMD_USSD_CANCEL';
ntAtDriver.AT_CMD_USSD_SEND                    = 'CMD_USSD_SEND';
ntAtDriver.AT_CMD_KEYPAD                       = 'CMD_KEYPAD';
ntAtDriver.AT_CMD_KEYPAD_ACCESS                = 'CMD_KEYPAD_ACCESS';
ntAtDriver.AT_CMD_KEYPAD_LOCK                  = 'CMD_KEYPAD_LOCK';
ntAtDriver.AT_CMD_CSQ                          = 'CMD_CSQ';
ntAtDriver.AT_CMD_CHARSET_LIST                 = 'CMD_CHARSET_LIST';
ntAtDriver.AT_CMD_CHARSET_GET                  = 'CMD_CHARSET_GET';
ntAtDriver.AT_CMD_CHARSET_SET                  = 'CMD_CHARSET_SET';
ntAtDriver.AT_CMD_NETWORK_LIST                 = 'CMD_NETWORK_LIST';
ntAtDriver.AT_CMD_NETWORK_GET                  = 'CMD_NETWORK_GET';
ntAtDriver.AT_RESPONSE_OK                      = 'RESPONSE_OK';
ntAtDriver.AT_RESPONSE_ERROR                   = 'RESPONSE_ERROR';
ntAtDriver.AT_RESPONSE_RING                    = 'RESPONSE_RING';
ntAtDriver.AT_RESPONSE_NO_CARRIER              = 'RESPONSE_NO_CARRIER';
ntAtDriver.AT_RESPONSE_NOT_SUPPORTED           = 'RESPONSE_NOT_SUPPORTED';
ntAtDriver.AT_RESPONSE_SMSC                    = 'RESPONSE_SMSC';
ntAtDriver.AT_RESPONSE_SMS_PROMPT              = 'RESPONSE_SMS_PROMPT';
ntAtDriver.AT_RESPONSE_NEW_MESSAGE             = 'RESPONSE_NEW_MESSAGE';
ntAtDriver.AT_RESPONSE_NEW_MESSAGE_DIRECT      = 'RESPONSE_NEW_MESSAGE_DIRECT';
ntAtDriver.AT_RESPONSE_DELIVERY_REPORT         = 'RESPONSE_DELIVERY_REPORT';
ntAtDriver.AT_RESPONSE_DELIVERY_REPORT_DIRECT  = 'RESPONSE_DELIVERY_REPORT_DIRECT';
ntAtDriver.AT_RESPONSE_CPMS                    = 'RESPONSE_CPMS';
ntAtDriver.AT_RESPONSE_CMGF                    = 'RESPONSE_CMGF';
ntAtDriver.AT_RESPONSE_CMGR                    = 'RESPONSE_CMGR';
ntAtDriver.AT_RESPONSE_CMGL                    = 'RESPONSE_CMGL';
ntAtDriver.AT_RESPONSE_CMGS                    = 'RESPONSE_CMGS';
ntAtDriver.AT_RESPONSE_CLIP                    = 'RESPONSE_CLIP';
ntAtDriver.AT_RESPONSE_CUSD                    = 'RESPONSE_CUSD';
ntAtDriver.AT_RESPONSE_CSCS                    = 'RESPONSE_CSCS';
ntAtDriver.AT_RESPONSE_CLCK                    = 'RESPONSE_CLCK';
ntAtDriver.AT_RESPONSE_CSQ                     = 'RESPONSE_CSQ';
ntAtDriver.AT_RESPONSE_RSSI                    = 'RESPONSE_RSSI';
ntAtDriver.AT_RESPONSE_CALL_END                = 'RESPONSE_CALL_END';
ntAtDriver.AT_RESPONSE_COPS                    = 'RESPONSE_COPS';
ntAtDriver.AT_RESPONSE_MEM_FULL                = 'RESPONSE_MEM_FULL';
ntAtDriver.AT_RESPONSE_CME_ERROR               = 'RESPONSE_CME_ERROR';
ntAtDriver.AT_RESPONSE_CMS_ERROR               = 'RESPONSE_CMS_ERROR';

ntAtDriver.load = function(filename) {
    if (fs.existsSync(filename)) {
        var config = ini.parse(fs.readFileSync(filename, 'utf-8'));
        for (var key in config) {
            var items = config[key];
            var drvName = key;
            var drvDesc = key;
            var drvParent = null;
            // description
            var s = ntAtDriverUtil.getNonCmdProps(items);
            if (typeof s != 'undefined') {
                var drvDesc = s;
                var items = items[s];
            }
            // parent
            var s = ntAtDriverUtil.getNonCmdProps(items);
            if (typeof s != 'undefined') {
                var drvParent = s;
                var items = items[s];
            }
            var drv = new this.factory(drvParent);
            drv.name = drvName;
            drv.desc = drvDesc;
            drv.import(items);
            this.add(drv);
        }
    }
}

ntAtDriver.add = function(driver) {
    if (typeof driver.name == 'undefined') {
        throw new Error('Invalid AT driver object.');
    }
    if (typeof Drivers[driver.name] != 'undefined') {
        throw new Error('Driver ' + driver.name + ' already registered.');
    }
    Drivers[driver.name] = driver;
}

ntAtDriver.get = function(name) {
    if (typeof Drivers[name] != 'undefined') {
        return Drivers[name];
    }
}

ntAtDriver.names = function() {
    return ntAtDriverUtil.getObjectProps(Drivers);
}

ntAtDriver.match = function(s) {
    var driver = '';
    for (var drv in Drivers) {
        if (s.toLowerCase() == drv.toLowerCase()) {
            driver = drv;
            break;
        } else {
            if (s.toLowerCase().indexOf(drv.toLowerCase()) >= 0) {
                if (driver.length < drv.length) {
                    driver = drv;
                }
            }
        }
    }
    return driver;
}

ntAtDriver.factory = function(parent) {
    this.name = 'Generic';
    this.desc = 'Generic';
    this.commands = {};
    this.init();
    if (typeof parent != 'undefined') {
        var p = ntAtDriver.get(parent);
        if (p) {
            this.import(p.commands);
        }
    }
}

ntAtDriver.factory.prototype.init = function() {
    this.add(ntAtDriver.AT_PARAM_TERMINATOR,                 '%CR%%LF%');
    this.add(ntAtDriver.AT_PARAM_DEVICE_NAME,                '%MANUF% %MODEL%');
    this.add(ntAtDriver.AT_PARAM_KEYPAD_CHARSET,             '%NONE%');
    this.add(ntAtDriver.AT_PARAM_SMS_MODE,                   ntAtConst.SMS_MODE_PDU.toString());
    this.add(ntAtDriver.AT_PARAM_SMS_COMMIT,                 String.fromCharCode(0x1a));
    this.add(ntAtDriver.AT_PARAM_SMS_CANCEL,                 String.fromCharCode(0x1b));
    this.add(ntAtDriver.AT_PARAM_SMS_STORAGE,                '%NONE%');
    this.add(ntAtDriver.AT_PARAM_USSD_ENCODED,               '0');
    this.add(ntAtDriver.AT_PARAM_USSD_ENCODING,              ntAtConst.USSD_ENC_7BIT.toString());
    this.add(ntAtDriver.AT_PARAM_USSD_RESPONSE_ENCODED,      '0');
    this.add(ntAtDriver.AT_CMD_INIT,                         'ATZ');
    this.add(ntAtDriver.AT_CMD_INIT + '1',                   'ATE0');
    this.add(ntAtDriver.AT_CMD_Q_FRIENDLY_NAME,              'ATI');
    this.add(ntAtDriver.AT_CMD_Q_MANUFACTURER,               'AT+CGMI');
    this.add(ntAtDriver.AT_CMD_Q_MODEL,                      'AT+CGMM');
    this.add(ntAtDriver.AT_CMD_Q_VERSION,                    'AT+CGMR');
    this.add(ntAtDriver.AT_CMD_Q_IMEI,                       'AT+CGSN');
    this.add(ntAtDriver.AT_CMD_Q_IMSI,                       'AT+CIMI');
    this.add(ntAtDriver.AT_CMD_Q_SMSC,                       'AT+CSCA?');
    this.add(ntAtDriver.AT_CMD_CALL_MONITOR,                 'AT+CLIP=1');
    this.add(ntAtDriver.AT_CMD_SMS_MONITOR,                  'AT+CNMI=2,1,,2');
    this.add(ntAtDriver.AT_CMD_DIAL,                         'ATD%PHONE_NUMBER%;');
    this.add(ntAtDriver.AT_CMD_ANSWER,                       'ATA');
    this.add(ntAtDriver.AT_CMD_HANGUP,                       'ATH');
    this.add(ntAtDriver.AT_CMD_SMS_STORAGE_GET,              'AT+CPMS?');
    this.add(ntAtDriver.AT_CMD_SMS_STORAGE_SET,              'AT+CPMS="%STORAGE%"');
    this.add(ntAtDriver.AT_CMD_SMS_READ,                     'AT+CMGR=%SMS_ID%');
    this.add(ntAtDriver.AT_CMD_SMS_DELETE,                   'AT+CMGD=%SMS_ID%');
    this.add(ntAtDriver.AT_CMD_SMS_LIST,                     'AT+CMGL=%SMS_STAT%');
    this.add(ntAtDriver.AT_CMD_SMS_MODE_GET,                 'AT+CMGF?');
    this.add(ntAtDriver.AT_CMD_SMS_MODE_SET,                 'AT+CMGF=%SMS_MODE%');
    this.add(ntAtDriver.AT_CMD_SMS_SEND_PDU,                 'AT+CMGS=%SMS_LEN%');
    this.add(ntAtDriver.AT_CMD_SMS_SEND_TEXT,                'AT+CMGS="%PHONE_NUMBER%"');
    this.add(ntAtDriver.AT_CMD_SMS_SEND_COMMIT,              '%MESSAGE%%COMMIT%');
    this.add(ntAtDriver.AT_CMD_USSD_SET,                     'AT+CUSD=1');
    this.add(ntAtDriver.AT_CMD_USSD_CANCEL,                  'AT+CUSD=2');
    this.add(ntAtDriver.AT_CMD_USSD_SEND,                    'AT+CUSD=1,%SERVICE_NUMBER%,%ENC%');
    this.add(ntAtDriver.AT_CMD_KEYPAD,                       'AT+CKPD="%KEYS%"');
    this.add(ntAtDriver.AT_CMD_KEYPAD_ACCESS,                'AT+CMEC=2');
    this.add(ntAtDriver.AT_CMD_KEYPAD_LOCK,                  'AT+CLCK="CS",%VALUE%');
    this.add(ntAtDriver.AT_CMD_CSQ,                          'AT+CSQ');
    this.add(ntAtDriver.AT_CMD_CHARSET_LIST,                 'AT+CSCS=?');
    this.add(ntAtDriver.AT_CMD_CHARSET_GET,                  'AT+CSCS?');
    this.add(ntAtDriver.AT_CMD_CHARSET_SET,                  'AT+CSCS="%CHARSET%"');
    this.add(ntAtDriver.AT_CMD_NETWORK_LIST,                 'AT+COPS=?');
    this.add(ntAtDriver.AT_CMD_NETWORK_GET,                  'AT+COPS?');
    this.add(ntAtDriver.AT_RESPONSE_OK,                      'OK');
    this.add(ntAtDriver.AT_RESPONSE_ERROR,                   'ERROR');
    this.add(ntAtDriver.AT_RESPONSE_RING,                    'RING');
    this.add(ntAtDriver.AT_RESPONSE_NO_CARRIER,              'NO CARRIER');
    this.add(ntAtDriver.AT_RESPONSE_NOT_SUPPORTED,           'COMMAND NOT SUPPORT');
    this.add(ntAtDriver.AT_RESPONSE_SMSC,                    '+CSCA:');
    this.add(ntAtDriver.AT_RESPONSE_SMS_PROMPT,              '> ');
    this.add(ntAtDriver.AT_RESPONSE_NEW_MESSAGE,             '+CMTI:');
    this.add(ntAtDriver.AT_RESPONSE_NEW_MESSAGE_DIRECT,      '+CMT:');
    this.add(ntAtDriver.AT_RESPONSE_DELIVERY_REPORT,         '+CDSI:');
    this.add(ntAtDriver.AT_RESPONSE_DELIVERY_REPORT_DIRECT,  '+CDS:');
    this.add(ntAtDriver.AT_RESPONSE_CPMS,                    '+CPMS:');
    this.add(ntAtDriver.AT_RESPONSE_CMGF,                    '+CMGF:');
    this.add(ntAtDriver.AT_RESPONSE_CMGR,                    '+CMGR:');
    this.add(ntAtDriver.AT_RESPONSE_CMGL,                    '+CMGL:');
    this.add(ntAtDriver.AT_RESPONSE_CMGS,                    '+CMGS:');
    this.add(ntAtDriver.AT_RESPONSE_CLIP,                    '+CLIP:');
    this.add(ntAtDriver.AT_RESPONSE_CUSD,                    '+CUSD:');
    this.add(ntAtDriver.AT_RESPONSE_CSCS,                    '+CSCS:');
    this.add(ntAtDriver.AT_RESPONSE_CLCK,                    '+CLCK:');
    this.add(ntAtDriver.AT_RESPONSE_CSQ,                     '+CSQ:');
    this.add(ntAtDriver.AT_RESPONSE_RSSI,                    '%NONE%');
    this.add(ntAtDriver.AT_RESPONSE_CALL_END,                '%NONE%');
    this.add(ntAtDriver.AT_RESPONSE_COPS,                    '+COPS:');
    this.add(ntAtDriver.AT_RESPONSE_MEM_FULL,                '%NONE%');
    this.add(ntAtDriver.AT_RESPONSE_CME_ERROR,               '+CME ERROR:');
    this.add(ntAtDriver.AT_RESPONSE_CMS_ERROR,               '+CMS ERROR:');
}

ntAtDriver.factory.prototype.import = function(commands) {
    if (typeof commands != 'undefined') {
        for (var cmd in commands) {
            this.add(cmd, commands[cmd]);
        }
    }
}

ntAtDriver.factory.prototype.check = function(key) {
    if (typeof key == 'undefined') {
        throw new Error('Key must be defined!');
    }
}

ntAtDriver.factory.prototype.add = function(key, value) {
    this.check(key);
    this.commands[key] = value;
}

ntAtDriver.factory.prototype.get = function(key) {
    this.check(key);
    if (this.commands[key]) {
        return this.commands[key];
    }
}

ntAtDriver.factory.prototype.has = function(key) {
    this.check(key);
    return typeof this.commands[key] != 'undefined' ? true : false;
}

// ntAtDriverUtil

ntAtDriverUtil = {
    getObjectProps: function(o) {
        return Object.keys(o);
    },
    getNonCmdProps: function(o) {
        var keys = this.getObjectProps(o);
        if (keys.length == 1) {
            if (keys[0].substr(0, 4) != 'CMD_' &&
                keys[0].substr(0, 6) != 'PARAM_' &&
                keys[0].substr(0, 9) != 'RESPONSE_') {
                return keys[0];
            }
        }
    }
}

if (typeof ntAtDriver.get('Generic') == 'undefined') {
    ntAtDriver.add(new ntAtDriver.factory());
}
