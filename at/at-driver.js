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

const fs         = require('fs');
const ini        = require('ini');
const ntAtConst  = require('./at-const');

/**
 * AT driver constants.
 */
class ntAtDriverConstants {

    static get AT_PARAM_TERMINATOR()                { return 'PARAM_TERMINATOR' }
    static get AT_PARAM_DEVICE_NAME()               { return 'PARAM_DEVICE_NAME' }
    static get AT_PARAM_KEYPAD_CHARSET()            { return 'PARAM_KEYPAD_CHARSET' }
    static get AT_PARAM_SMS_MODE()                  { return 'PARAM_SMS_MODE' }
    static get AT_PARAM_SMS_COMMIT()                { return 'PARAM_SMS_COMMIT' }
    static get AT_PARAM_SMS_CANCEL()                { return 'PARAM_SMS_CANCEL' }
    static get AT_PARAM_SMS_STORAGE()               { return 'PARAM_SMS_STORAGE' }
    static get AT_PARAM_SMS_WAIT_PROMPT()           { return 'PARAM_SMS_WAIT_PROMPT' }
    static get AT_PARAM_USSD_ENCODED()              { return 'PARAM_USSD_ENCODED' }
    static get AT_PARAM_USSD_ENCODING()             { return 'PARAM_USSD_ENCODING' }
    static get AT_PARAM_USSD_RESPONSE_ENCODED()     { return 'PARAM_USSD_RESPONSE_ENCODED' }
    static get AT_CMD_INIT()                        { return 'CMD_INIT' }
    static get AT_CMD_Q_FRIENDLY_NAME()             { return 'CMD_QUERY_FRIENDLY_NAME' }
    static get AT_CMD_Q_MANUFACTURER()              { return 'CMD_QUERY_MANUFACTURER' }
    static get AT_CMD_Q_MODEL()                     { return 'CMD_QUERY_MODEL' }
    static get AT_CMD_Q_VERSION()                   { return 'CMD_QUERY_VERSION' }
    static get AT_CMD_Q_IMEI()                      { return 'CMD_QUERY_IMEI' }
    static get AT_CMD_Q_IMSI()                      { return 'CMD_QUERY_IMSI' }
    static get AT_CMD_Q_SMSC()                      { return 'CMD_QUERY_SMSC' }
    static get AT_CMD_DIAL()                        { return 'CMD_DIAL' }
    static get AT_CMD_ANSWER()                      { return 'CMD_ANSWER' }
    static get AT_CMD_HANGUP()                      { return 'CMD_HANGUP' }
    static get AT_CMD_CALL_MONITOR()                { return 'CMD_CALL_MONITOR' }
    static get AT_CMD_SMS_MONITOR()                 { return 'CMD_SMS_MONITOR' }
    static get AT_CMD_SMS_STORAGE_GET()             { return 'CMD_SMS_STORAGE_GET' }
    static get AT_CMD_SMS_STORAGE_SET()             { return 'CMD_SMS_STORAGE_SET' }
    static get AT_CMD_SMS_READ()                    { return 'CMD_SMS_READ' }
    static get AT_CMD_SMS_DELETE()                  { return 'CMD_SMS_DELETE' }
    static get AT_CMD_SMS_LIST()                    { return 'CMD_SMS_LIST' }
    static get AT_CMD_SMS_MODE_SET()                { return 'CMD_SMS_MODE_SET' }
    static get AT_CMD_SMS_MODE_GET()                { return 'CMD_SMS_MODE_GET' }
    static get AT_CMD_SMS_SEND_PDU()                { return 'CMD_SMS_SEND_PDU' }
    static get AT_CMD_SMS_SEND_TEXT()               { return 'CMD_SMS_SEND_TEXT' }
    static get AT_CMD_SMS_SEND_COMMIT()             { return 'CMD_SMS_SEND_COMMIT' }
    static get AT_CMD_USSD_SET()                    { return 'CMD_USSD_SET' }
    static get AT_CMD_USSD_CANCEL()                 { return 'CMD_USSD_CANCEL' }
    static get AT_CMD_USSD_SEND()                   { return 'CMD_USSD_SEND' }
    static get AT_CMD_KEYPAD()                      { return 'CMD_KEYPAD' }
    static get AT_CMD_KEYPAD_ACCESS()               { return 'CMD_KEYPAD_ACCESS' }
    static get AT_CMD_KEYPAD_LOCK()                 { return 'CMD_KEYPAD_LOCK' }
    static get AT_CMD_CSQ()                         { return 'CMD_CSQ' }
    static get AT_CMD_CHARSET_LIST()                { return 'CMD_CHARSET_LIST' }
    static get AT_CMD_CHARSET_GET()                 { return 'CMD_CHARSET_GET' }
    static get AT_CMD_CHARSET_SET()                 { return 'CMD_CHARSET_SET' }
    static get AT_CMD_NETWORK_LIST()                { return 'CMD_NETWORK_LIST' }
    static get AT_CMD_NETWORK_GET()                 { return 'CMD_NETWORK_GET' }
    static get AT_RESPONSE_OK()                     { return 'RESPONSE_OK' }
    static get AT_RESPONSE_ERROR()                  { return 'RESPONSE_ERROR' }
    static get AT_RESPONSE_RING()                   { return 'RESPONSE_RING' }
    static get AT_RESPONSE_NO_CARRIER()             { return 'RESPONSE_NO_CARRIER' }
    static get AT_RESPONSE_NOT_SUPPORTED()          { return 'RESPONSE_NOT_SUPPORTED' }
    static get AT_RESPONSE_SMSC()                   { return 'RESPONSE_SMSC' }
    static get AT_RESPONSE_SMS_PROMPT()             { return 'RESPONSE_SMS_PROMPT' }
    static get AT_RESPONSE_NEW_MESSAGE()            { return 'RESPONSE_NEW_MESSAGE' }
    static get AT_RESPONSE_NEW_MESSAGE_DIRECT()     { return 'RESPONSE_NEW_MESSAGE_DIRECT' }
    static get AT_RESPONSE_DELIVERY_REPORT()        { return 'RESPONSE_DELIVERY_REPORT' }
    static get AT_RESPONSE_DELIVERY_REPORT_DIRECT() { return 'RESPONSE_DELIVERY_REPORT_DIRECT' }
    static get AT_RESPONSE_CPMS()                   { return 'RESPONSE_CPMS' }
    static get AT_RESPONSE_CMGF()                   { return 'RESPONSE_CMGF' }
    static get AT_RESPONSE_CMGR()                   { return 'RESPONSE_CMGR' }
    static get AT_RESPONSE_CMGL()                   { return 'RESPONSE_CMGL' }
    static get AT_RESPONSE_CMGS()                   { return 'RESPONSE_CMGS' }
    static get AT_RESPONSE_CLIP()                   { return 'RESPONSE_CLIP' }
    static get AT_RESPONSE_CUSD()                   { return 'RESPONSE_CUSD' }
    static get AT_RESPONSE_CSCS()                   { return 'RESPONSE_CSCS' }
    static get AT_RESPONSE_CLCK()                   { return 'RESPONSE_CLCK' }
    static get AT_RESPONSE_CSQ()                    { return 'RESPONSE_CSQ' }
    static get AT_RESPONSE_RSSI()                   { return 'RESPONSE_RSSI' }
    static get AT_RESPONSE_CALL_END()               { return 'RESPONSE_CALL_END' }
    static get AT_RESPONSE_COPS()                   { return 'RESPONSE_COPS' }
    static get AT_RESPONSE_MEM_FULL()               { return 'RESPONSE_MEM_FULL' }
    static get AT_RESPONSE_CME_ERROR()              { return 'RESPONSE_CME_ERROR' }
    static get AT_RESPONSE_CMS_ERROR()              { return 'RESPONSE_CMS_ERROR' }

}

/**
 * AT communication driver.
 */
class ntAtDriver {

    constructor(parent = null) {
        this.name = 'Generic';
        this.desc = 'Generic';
        this.parent = null;
        this.commands = {};
        this.init();
        if (parent && parent.constructor && parent.constructor.name == this.constructor.name) {
            this.parent = parent;
            this.import(this.parent.commands);
        }
    }

    init() {
        this.add(ntAtDriverConstants.AT_PARAM_TERMINATOR,                 '%CR%%LF%');
        this.add(ntAtDriverConstants.AT_PARAM_DEVICE_NAME,                '%MANUF% %MODEL%');
        this.add(ntAtDriverConstants.AT_PARAM_KEYPAD_CHARSET,             '%NONE%');
        this.add(ntAtDriverConstants.AT_PARAM_SMS_MODE,                   ntAtConst.SMS_MODE_PDU.toString());
        this.add(ntAtDriverConstants.AT_PARAM_SMS_COMMIT,                 String.fromCharCode(0x1a));
        this.add(ntAtDriverConstants.AT_PARAM_SMS_CANCEL,                 String.fromCharCode(0x1b));
        this.add(ntAtDriverConstants.AT_PARAM_SMS_STORAGE,                '%NONE%');
        this.add(ntAtDriverConstants.AT_PARAM_SMS_WAIT_PROMPT,            '1');
        this.add(ntAtDriverConstants.AT_PARAM_USSD_ENCODED,               '0');
        this.add(ntAtDriverConstants.AT_PARAM_USSD_ENCODING,              ntAtConst.USSD_ENC_7BIT.toString());
        this.add(ntAtDriverConstants.AT_PARAM_USSD_RESPONSE_ENCODED,      '0');
        this.add(ntAtDriverConstants.AT_CMD_INIT,                         'ATZ');
        this.add(ntAtDriverConstants.AT_CMD_INIT + '1',                   'ATE0');
        this.add(ntAtDriverConstants.AT_CMD_Q_FRIENDLY_NAME,              'ATI');
        this.add(ntAtDriverConstants.AT_CMD_Q_MANUFACTURER,               'AT+CGMI');
        this.add(ntAtDriverConstants.AT_CMD_Q_MODEL,                      'AT+CGMM');
        this.add(ntAtDriverConstants.AT_CMD_Q_VERSION,                    'AT+CGMR');
        this.add(ntAtDriverConstants.AT_CMD_Q_IMEI,                       'AT+CGSN');
        this.add(ntAtDriverConstants.AT_CMD_Q_IMSI,                       'AT+CIMI');
        this.add(ntAtDriverConstants.AT_CMD_Q_SMSC,                       'AT+CSCA?');
        this.add(ntAtDriverConstants.AT_CMD_CALL_MONITOR,                 'AT+CLIP=1');
        this.add(ntAtDriverConstants.AT_CMD_SMS_MONITOR,                  'AT+CNMI=2,1,,2');
        this.add(ntAtDriverConstants.AT_CMD_DIAL,                         'ATD%PHONE_NUMBER%;');
        this.add(ntAtDriverConstants.AT_CMD_ANSWER,                       'ATA');
        this.add(ntAtDriverConstants.AT_CMD_HANGUP,                       'ATH');
        this.add(ntAtDriverConstants.AT_CMD_SMS_STORAGE_GET,              'AT+CPMS?');
        this.add(ntAtDriverConstants.AT_CMD_SMS_STORAGE_SET,              'AT+CPMS="%STORAGE%"');
        this.add(ntAtDriverConstants.AT_CMD_SMS_READ,                     'AT+CMGR=%SMS_ID%');
        this.add(ntAtDriverConstants.AT_CMD_SMS_DELETE,                   'AT+CMGD=%SMS_ID%');
        this.add(ntAtDriverConstants.AT_CMD_SMS_LIST,                     'AT+CMGL=%SMS_STAT%');
        this.add(ntAtDriverConstants.AT_CMD_SMS_MODE_GET,                 'AT+CMGF?');
        this.add(ntAtDriverConstants.AT_CMD_SMS_MODE_SET,                 'AT+CMGF=%SMS_MODE%');
        this.add(ntAtDriverConstants.AT_CMD_SMS_SEND_PDU,                 'AT+CMGS=%SMS_LEN%');
        this.add(ntAtDriverConstants.AT_CMD_SMS_SEND_TEXT,                'AT+CMGS="%PHONE_NUMBER%"');
        this.add(ntAtDriverConstants.AT_CMD_SMS_SEND_COMMIT,              '%MESSAGE%%COMMIT%');
        this.add(ntAtDriverConstants.AT_CMD_USSD_SET,                     'AT+CUSD=1');
        this.add(ntAtDriverConstants.AT_CMD_USSD_CANCEL,                  'AT+CUSD=2');
        this.add(ntAtDriverConstants.AT_CMD_USSD_SEND,                    'AT+CUSD=1,%SERVICE_NUMBER%,%ENC%');
        this.add(ntAtDriverConstants.AT_CMD_KEYPAD,                       'AT+CKPD="%KEYS%"');
        this.add(ntAtDriverConstants.AT_CMD_KEYPAD_ACCESS,                'AT+CMEC=2');
        this.add(ntAtDriverConstants.AT_CMD_KEYPAD_LOCK,                  'AT+CLCK="CS",%VALUE%');
        this.add(ntAtDriverConstants.AT_CMD_CSQ,                          'AT+CSQ');
        this.add(ntAtDriverConstants.AT_CMD_CHARSET_LIST,                 'AT+CSCS=?');
        this.add(ntAtDriverConstants.AT_CMD_CHARSET_GET,                  'AT+CSCS?');
        this.add(ntAtDriverConstants.AT_CMD_CHARSET_SET,                  'AT+CSCS="%CHARSET%"');
        this.add(ntAtDriverConstants.AT_CMD_NETWORK_LIST,                 'AT+COPS=?');
        this.add(ntAtDriverConstants.AT_CMD_NETWORK_GET,                  'AT+COPS?');
        this.add(ntAtDriverConstants.AT_RESPONSE_OK,                      'OK');
        this.add(ntAtDriverConstants.AT_RESPONSE_ERROR,                   'ERROR');
        this.add(ntAtDriverConstants.AT_RESPONSE_RING,                    'RING');
        this.add(ntAtDriverConstants.AT_RESPONSE_NO_CARRIER,              'NO CARRIER');
        this.add(ntAtDriverConstants.AT_RESPONSE_NOT_SUPPORTED,           'COMMAND NOT SUPPORT');
        this.add(ntAtDriverConstants.AT_RESPONSE_SMSC,                    '+CSCA:');
        this.add(ntAtDriverConstants.AT_RESPONSE_SMS_PROMPT,              '> ');
        this.add(ntAtDriverConstants.AT_RESPONSE_NEW_MESSAGE,             '+CMTI:');
        this.add(ntAtDriverConstants.AT_RESPONSE_NEW_MESSAGE_DIRECT,      '+CMT:');
        this.add(ntAtDriverConstants.AT_RESPONSE_DELIVERY_REPORT,         '+CDSI:');
        this.add(ntAtDriverConstants.AT_RESPONSE_DELIVERY_REPORT_DIRECT,  '+CDS:');
        this.add(ntAtDriverConstants.AT_RESPONSE_CPMS,                    '+CPMS:');
        this.add(ntAtDriverConstants.AT_RESPONSE_CMGF,                    '+CMGF:');
        this.add(ntAtDriverConstants.AT_RESPONSE_CMGR,                    '+CMGR:');
        this.add(ntAtDriverConstants.AT_RESPONSE_CMGL,                    '+CMGL:');
        this.add(ntAtDriverConstants.AT_RESPONSE_CMGS,                    '+CMGS:');
        this.add(ntAtDriverConstants.AT_RESPONSE_CLIP,                    '+CLIP:');
        this.add(ntAtDriverConstants.AT_RESPONSE_CUSD,                    '+CUSD:');
        this.add(ntAtDriverConstants.AT_RESPONSE_CSCS,                    '+CSCS:');
        this.add(ntAtDriverConstants.AT_RESPONSE_CLCK,                    '+CLCK:');
        this.add(ntAtDriverConstants.AT_RESPONSE_CSQ,                     '+CSQ:');
        this.add(ntAtDriverConstants.AT_RESPONSE_RSSI,                    '%NONE%');
        this.add(ntAtDriverConstants.AT_RESPONSE_CALL_END,                '%NONE%');
        this.add(ntAtDriverConstants.AT_RESPONSE_COPS,                    '+COPS:');
        this.add(ntAtDriverConstants.AT_RESPONSE_MEM_FULL,                '%NONE%');
        this.add(ntAtDriverConstants.AT_RESPONSE_CME_ERROR,               '+CME ERROR:');
        this.add(ntAtDriverConstants.AT_RESPONSE_CMS_ERROR,               '+CMS ERROR:');
    }

    import(commands) {
        if (typeof commands != 'undefined') {
            for (let cmd in commands) {
                this.add(cmd, commands[cmd]);
            }
        }
    }

    check(key) {
        if (typeof key == 'undefined') {
            throw new Error('Key must be defined!');
        }
    }

    add(key, value) {
        this.check(key);
        this.commands[key] = value;
    }

    get(key) {
        this.check(key);
        if (this.commands[key]) {
            return this.commands[key];
        }
    }

    has(key) {
        this.check(key);
        return typeof this.commands[key] != 'undefined' ? true : false;
    }
}

/**
 * AT driver collection.
 */
class ntAtDrivers {

    drivers = {}

    /**
     * Load driver from INI file.
     *
     * @param {String} filename The filename
     */
    load(filename) {
        if (fs.existsSync(filename)) {
            const config = ini.parse(fs.readFileSync(filename, 'utf-8'));
            for (let key in config) {
                let items = config[key];
                let drvName = key;
                let drvDesc = key;
                let drvParent = null;
                // description
                let s = ntAtDriverUtil.getNonCmdProps(items);
                if (typeof s != 'undefined') {
                    drvDesc = s;
                    items = items[s];
                }
                // parent
                s = ntAtDriverUtil.getNonCmdProps(items);
                if (typeof s != 'undefined') {
                    drvParent = this.get(s);
                    items = items[s];
                }
                let drv = new ntAtDriver(drvParent);
                drv.name = drvName;
                drv.desc = drvDesc;
                drv.import(items);
                this.add(drv);
            }
        }
    }

    /**
     * Add driver.
     *
     * @param {ntAtDriver} driver The driver
     */
    add(driver) {
        if (typeof driver.name == 'undefined') {
            throw new Error('Invalid AT driver object.');
        }
        if (typeof this.drivers[driver.name] != 'undefined') {
            throw new Error('Driver ' + driver.name + ' already registered.');
        }
        this.drivers[driver.name] = driver;
    }

    /**
     * Get driver.
     *
     * @param {String} name  The driver name
     * @returns {ntAtDriver} The driver
     */
    get(name) {
        if (typeof this.drivers[name] != 'undefined') {
            return this.drivers[name];
        }
    }

    /**
     * Get available driver names.
     *
     * @returns {String[]}
     */
    names() {
        return ntAtDriverUtil.getObjectProps(this.drivers);
    }

    match(s) {
        let driver = '';
        for (let drv in this.drivers) {
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
}

/**
 * AT driver utility.
 */
class ntAtDriverUtil {

    static getObjectProps(o) {
        return Object.keys(o);
    }

    static getNonCmdProps(o) {
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

const drivers = new ntAtDrivers();
if (typeof drivers.get('Generic') == 'undefined') {
    drivers.add(new ntAtDriver());
}

module.exports = {
    ntAtDriver: drivers,
    ntAtDriverConstants: ntAtDriverConstants,
}
