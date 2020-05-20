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

const CharSequence  = require('./../lib/charseq');

const BIT_0         = 0x01;
const BIT_1         = 0x02;
const BIT_2         = 0x04;
const BIT_3         = 0x08;
const BIT_4         = 0x10;
const BIT_5         = 0x20;
const BIT_6         = 0x40;
const BIT_7         = 0x80;

/** @type {ntAtSms}  */
let sms;

/**
 * GSM SMS functions, originally taken from https://sourceforge.net/projects/fma/.
 */
class ntAtSms {

    Alphabet7Escape = 0x1b // 27

    /*
      The ETSI GSM 03.38 specification shows an uppercase C-cedilla (code 199)
      glyph at 0x09. This may be the result of limited display
      capabilities for handling characters with descenders. However, the
      language coverage intent is clearly for the lowercase c-cedilla
      which has code 231 (see mapping 09th).
    */

    Alphabet7Bit = [
        /*        0      1      2      3      4      5      6      7      8      9      A      B      C      D      E      F */
        /*0*/    64,   163,    36,   165,   232,   233,   249,   236,   242,   199,    10,   216,   248,    13,   197,   229,
        /*1*/ 0x394,    95, 0x3A6, 0x393, 0x39B, 0x3A9, 0x3A0, 0x3A8, 0x3A3, 0x398, 0x39E,    27,   198,   230,   223,   201,
        /*2*/    32,    33,    34,    35,   164,    37,    38,    39,    40,    41,    42,    43,    44,    45,    46,    47,
        /*3*/    48,    49,    50,    51,    52,    53,    54,    55,    56,    57,    58,    59,    60,    61,    62,    63,
        /*4*/   161,    65,    66,    67,    68,    69,    70,    71,    72,    73,    74,    75,    76,    77,    78,    79,
        /*5*/    80,    81,    82,    83,    84,    85,    86,    87,    88,    89,    90,   196,   214,   209,   220,   167,
        /*6*/   191,    97,    98,    99,   100,   101,   102,   103,   104,   105,   106,   107,   108,   109,   110,   111,
        /*7*/   112,   113,   114,   115,   116,   117,   118,   119,   120,   121,   122,   228,   246,   241,   252,   224,
    ]

    Alphabet7Map = {
        '12': 10,
        '91': 60,
        '92': 47,
        '93': 62,
        '94': 20,
        '123': 40,
        '124': 64,
        '125': 41,
        '126': 61,
        '8364': 101, // Euro sign
        '-1': 63 // 63 = '?' (FMA specific implementation) should we fail/error here?
    }

    SMS_8BIT_REF    = 0
    SMS_16BIT_REF   = 8

    VALIDITY_1_HOUR = 60
    VALIDITY_1_DAY  = 1440
    CODING_SCHEME   = Object.freeze({CS_7BIT: 0, CS_8BIT: 1, CS_UCS2: 2, CS_UNKNOWN: 3})
    VALIDITY_PERIOD = Object.freeze({VP_NONE: 0, VP_ENHANCED: 1, VP_INTEGER: 2, VP_SEMIOCTET: 3})

    getAlphabet7MapKeys() {
        return Object.keys(this.Alphabet7Map).map(key => parseInt(key)).filter(key => key > 0);
    }

    getAlphabet7MapChar(char) {
        char = char.toString();
        if (this.Alphabet7Map[char]) {
            return this.Alphabet7Map[char];
        }
    }

    getAlphabet7MapKey(char) {
        let result;
        Object.keys(this.Alphabet7Map).forEach((key) => {
            if (this.Alphabet7Map[key] == char) {
                result = parseInt(key);
                return true;
            }
        });
        return result;
    }

    unpack7Bit(value) {
        let septet = '';
        let len = Math.round(value.length / 2) - 1;
        let x = 1;
        let leftover = 0;
        for (let i = 0; i <= len; i++) {
            let c = value.substr(i * 2, 2);
            if (!this.isHexChar(c.charAt(0))) break;
            if (c.length == 2 && !this.isHexChar(c.charAt(1))) {
                c = c.charAt(0);
            }
            let octet = parseInt('0x' + c);
            let char = ((octet & (0xff >> x)) << (x - 1)) | leftover;
            leftover = (octet & (~(0xff >> x))) >> (8 - x);
            septet += String.fromCharCode(char);
            x++;
            if (x == 8) {
                if (i !== len || leftover !== 0) septet += String.fromCharCode(leftover);
                x = 1;
                leftover = 0;
            }
        }
        return septet;
    }

    pack7Bit(value) {
        let octet = '';
        let len = value.length;
        let x = 0;
        let nextChar = 0;
        let char;
        for (let i = 0; i < len; i++) {
            if (x < 7) {
                nextChar = i == len - 1 ? 0 : value.charCodeAt(i + 1);
                char = ((nextChar & (~(0xff << (x + 1)))) << (7 - x)) | (value.charCodeAt(i) >> x);
                octet += this.hexPad(char.toString(16).toUpperCase(), 2);
                x++;
            } else {
              x = 0;
            }
        }
        return octet;
    }

    alphabetIndex7Bit(char) {
        return this.Alphabet7Bit.indexOf(char);
    }
    
    escapeIndex7Bit(char) {
        const indexedChar = this.getAlphabet7MapKeys();
        if (indexedChar.indexOf(char) >= 0) {
            return char;
        } else {
            return -1;
        }
    }

    is7Bit(char) {
        return (this.alphabetIndex7Bit(char) > -1 || this.escapeIndex7Bit(char) > -1) ? true : false;
    }

    encode7Bit(value) {
        let septet = '';
        for (let i = 0; i < value.length; i++) {
            let char = this.alphabetIndex7Bit(value.charCodeAt(i));
            if (char == -1) {
                char = this.escapeIndex7Bit(value.charCodeAt(i));
                let mapped = this.getAlphabet7MapChar(char);
                if (typeof mapped != 'undefined') {
                    char = mapped;
                } else {
                    throw new Error('Unable to find map for character code ' + char.toString() + '.');
                }
                septet += String.fromCharCode(this.Alphabet7Escape);
            }
            septet += String.fromCharCode(char);
        }
        return septet;
    }

    gsmLength7Bit(value) {
        return this.encode7Bit(value).length;
    }

    gsmDecode7Bit(value) {
        let result = '';
        let i = 0;
        value = this.unpack7Bit(value);
        while (true) {
            if (i == value.length) break;
            let v = value.charCodeAt(i);
            let char = v <= this.Alphabet7Bit.length ? v : 0;
            if (v == this.Alphabet7Escape) {
                i++;
                if (i == value.length) break;
                /*
                  The ESC character 0x1B is mapped to the no-break space character, unless it is part of a
                  valid ESC sequence, to facilitate round-trip compatibility in the presence of unknown ESC
                  sequences.
                */
                let mapped = this.getAlphabet7MapKey(value.charCodeAt(i));
                if (typeof mapped != 'undefined') {
                    char = mapped;
                } else {
                    /*
                        Alphabet7Escape:
                        This code value is reserved for the extension to another extension table. On receipt of this
                        code, a receiving entity shall display a space until another extension table is defined.
                    */
                    if (value.charCodeAt(i) == 27) {
                        char = 32;
                    } else {
                        char = 63;
                        /*
                          63 = '?' (FMA specific implementation) }
                          // WE HAVE CONFLICT IN THE DOCS!!! A -or- B
                          { A. http://www.unicode.org/Public/MAPPINGS/ETSI/GSM0338.TXT
                            The ESC character 0x1B is mapped to the no-break space character, unless it is part of a
                            valid ESC sequence, to facilitate compatibility in the presence of unknown ESC sequences. }
                          { B. http://www.tvrelsat.com/sentinel/pdf/0338-700.pdf
                            In the event that an MS receives a code where a symbol is not represented in the ESC table
                            then the MS shall display the character shown in the main default 7 bit alphabet table. }
                        */
                    }
                }
            } else {
                /*
                  0x00 is NULL (when followed only by 0x00 up to the end of (fixed byte length) message, possibly
                  also up to FORM FEED.  But 0x00 is also the code for COMMERCIAL AT when some other character
                  (CARRIAGE RETURN if nothing else) comes after the 0x00.
                */
                if (char == 0 && i < value.length - 1 && value.charCodeAt(i + 1) == 0) {
                    let k = i + 2;
                    while (k < value.length && value.charCodeAt(k) == 0) k++; // 0x00 up to the...
                    if (k == value.length ||
                        (k < value.length - 1 && value.charCodeAt(k) == this.Alphabet7Escape && value.charCodeAt(k + 1) == 10)
                    ) {
                        i = k - 1;
                        char = 0;
                    }
                }
            }
            result += String.fromCharCode(char);
            i++;
        }
        return result;
    }

    gsmEncode7Bit(value) {
        return this.pack7Bit(this.encode7Bit(value))
    }

    gsmDecode8Bit(value) {
        let result = '';
        if ((value.length % 2) > 0) {
            let value = value + '0';
        }
        for (let i = 0; i < (value.length / 2) - 1; i++) {
            result += String.fromCharCode(value.substr(i * 2, 2));
        }
        return result;
    }

    gsmEncode8Bit(value) {
        let result = '';
        for (let i = 0; i < value.length; i++) {
            let char = value.charCodeAt(i);
            if (char > 255) {
                throw new Error('Unable to use 8bit encoding!');
            }
            result =+ char.toString(16).toUpperCase();
        }
        return result;
    }

    gsmDecodeUcs2(value) {
        // Convert HEX string sequence to UCS2
        while ((value.length % 4) > 0) value += '0';
        const len = value.length / 4;
        const buff = new Uint16Array(len);
        for (let i = 0; i < len; i++) {
            buff[i] = parseInt('0x' + value.substr(i * 4, 4));
        }
        return Buffer.from(buff).toString();
    }

    gsmEncodeUcs2(value) {
        let result = '';
        for (let i = 0; i < value.length; i++) {
            let char = this.hexPad(value.charCodeAt(i).toString(16).toUpperCase(), 4);
            result += char;
        }
        return result;
    }

    isHexChar(s) {
        return s.match(/[a-zA-Z0-9]/) ? true : false;
    }

    hexPad(s, len) {
        if (typeof len == 'undefined') {
            len = 2;
        }
        while ((s.length % len) > 0) s = '0' + s;
        return s;
    }

    bitSet(value, bit) {
        return (value & bit) == bit ? true : false;
    }

    detectCodingScheme(value) {
        let is7Bit = true;
        let is8Bit = true;
        for (let i = 0; i < value.length; i++) {
            let char = value.charCodeAt(i);
            if (is7Bit) {
                if (!this.is7Bit(char)) is7Bit = false;
            }
            if (is8Bit) {
                if (char > 255) is8Bit = false;
            }
            if (!is7Bit && !is8Bit) break;
        }
        switch (true) {
            case is7Bit:
                return this.CODING_SCHEME.CS_7BIT;
            case is8Bit:
                return this.CODING_SCHEME.CS_8BIT;
            default:
                return this.CODING_SCHEME.CS_UCS2;
        }
    }

    smsMaxLen(CODING_SCHEME, longMessage) {
        longMessage = longMessage || false;
        let len = 0;
        switch (CODING_SCHEME) {
            case this.CODING_SCHEME.CS_7BIT:
                len = 160;
                if (longMessage) len -= 7;
                break;
            case this.CODING_SCHEME.CS_8BIT:
                len = 140;
                if (longMessage) len -= 6;
                break;
            case this.CODING_SCHEME.CS_UCS2:
                len = 70;
                if (longMessage) len -= 3;
                break;
            default:
                break;
        }
        return len;
    }

    smsLen(codingScheme, value) {
        if (codingScheme == this.CODING_SCHEME.CS_7BIT) {
            return this.gsmLength7Bit(value);
        }
        return value.length;
    }

    smsSplit(codingScheme, value) {
        const values = [];
        if (this.smsLen(codingScheme, value) > this.smsMaxLen(codingScheme)) {
            const maxLen = this.smsMaxLen(codingScheme, true);
            while (true) {
                if (value.length == 0) break;
                let len = maxLen;
                while (true) {
                    if (this.smsLen(codingScheme, value.substr(0, len)) <= maxLen) {
                        break;
                    }
                    len--;
                }
                values.push(value.substr(0, len));
                value = value.substr(len);
            }
        } else {
            values.push(value);
        }
        return values;
    }

    reverseOctets(octets) {
        let result = '';
        let i = 0;
        while (i < (octets.length / 2)) {
            result += octets.charAt((i * 2) + 1) + octets.charAt((i * 2));
            i++;
        }
        return result;
    }

    decodeNumber(raw) {
        const addrType = parseInt('0x' + raw.substr(0, 2));
        const ton = (addrType & 0x70) >> 4;   // type of number
        const npi = (addrType & 0x0F);        // numbering plan identification
        let number = raw.substr(2);
        // alpha numeric
        if (ton == 5) {
            number = this.gsmDecode7Bit(number);
        } else {
            number = this.reverseOctets(number);
            if (number.length && number.substr(-1).toUpperCase() == 'F') {
                number = number.substr(0,  number.length - 1);
            }
            switch (ton) {
                case 1: // international number
                case 2: // national number
                    if (number.charAt(0) != '+') {
                        number = '+' + number;
                    }
                    break;
            }
        }
        return number;
    }

    encodeNumber(number) {
        let result = '81';
        if (number.length && number.substr(0, 1) == '+') {
            result = '91';
            number = number.substr(1);
        }
        result = this.hexPad(number.length.toString(16).toUpperCase()) + result;
        if ((number.length % 2) > 0) number += 'F';
        result += this.reverseOctets(number);
        return result;
    }

    makeCrLf(str) {
        let result = '';
        let skip = false;
        for (let i = 0; i < str.length; i++) {
            if (skip) {
                skip = false;
            } else {
                if (str.charAt(i) == '\r' || str.charAt(i) == '\n') {
                    if (i < str.length - 1 && (str.substr(i, 2) == '\r\n' || str.substr(i, 2) == '\n\r')) {
                        skip = true;
                    }
                    result += '\r\n';
                } else {
                    result += str.charAt(i);
                }
            }
        }
        return result;
    }

    decodeTimeStamp(raw) {
        if (raw.length != 14) {
            throw new Error('SMS PDU: Timestamp must have 7 octets!');
        }
        raw = this.reverseOctets(raw);
        let yr = parseInt(raw.substr(0, 2));
        let mo = parseInt(raw.substr(2, 2));
        let dy = parseInt(raw.substr(4, 2));
        let hr = parseInt(raw.substr(6, 2));
        let mn = parseInt(raw.substr(8, 2));
        let sc = parseInt(raw.substr(10, 2));
        /*
        7th octet is TimeZone
        The Time Zone indicates the difference, expressed in quarters of an hour,
        between the local time and GMT. In the first of the two semi-octets, the
        first bit (bit 3 of the seventh octet of the TP-Service-Centre-Time-Stamp
        field) represents the algebraic sign of this difference (0 : positive,
        1 : negative).
        */
        let tz = parseInt('0x' + raw.substr(12, 2));
        if ((tz & 0x80) > 0) { // octet is reversed -> now 7th bit (not 3rd)
            tz = tz & 0x7f;
            tz = -1 * parseInt('0x' + tz.toString(16));
        }
        tz = tz * 15; // offset in minutes
        /*
        If the MS has knowledge of the local time zone, then any time received
        (e.g. Service-Centre-Time-Stamp) at the MS may be displayed in the local
        time rather than the time local to the sending entity. Messages shall be
        stored as received without change to any time contained therein.
        */
        return new Date(yr > 90 ? yr + 1900 : yr + 2000, mo - 1, dy, hr, mn, sc, 0);
    }

    decodeValidity(format, value) {
        let validity = 0;
        switch (format) {
            case this.VALIDITY_PERIOD.VP_NONE:
                break;
            case this.VALIDITY_PERIOD.VP_ENHANCED:
                break;
            case this.VALIDITY_PERIOD.VP_INTEGER:
                // we will use negative values to identify offset value
                let v = parseInt('0x' + value);
                switch (v) {
                    case 0-143:
                        validity = (-1 / 24 / 12) * (v + 1); // 5mins*(val+1)
                        break;
                    case 144-167:
                        validity = (-1 / 2) + (-1 / 24 / 2) * (v - 143); // 12h + 30mins*(val-143)
                        break;
                    case 168-196:
                        validity = -1 * (v - 166); // (val-166)*1day
                    case 197-255:
                        validity = -7 * (v - 192); // (val-192)*1week
                  end;
                }
                break;
            case this.VALIDITY_PERIOD.VP_SEMIOCTET:
                validity = this.decodeTimeStamp(value);
                break;
        }
        return validity;
    }

    validityIndex(value) {
        let result = 0;
        // validity must be in minute
        if (value instanceof Date) {
            value = (value.getDate() * this.VALIDITY_1_DAY) +
                (value.getHours() * this.VALIDITY_1_HOUR) +
                value.getMinutes();
        }
        let hour = Math.floor(value / 60);
        let minute = value % 60;
        let day = Math.floor(hour / 24);
        let week = Math.floor(day / 7);
        day = day % 7;
        hour = hour % 24;
        if (week > 0) {
            if (Math.floor(week / 5) > 0) {
                if (result == 0) result = 197;
                result += (week - 5);
            } else {
                if (result == 0) result = 173;
                result += (week - 1) * 7;
            }
        }
        if (day > 0) {
            if (result == 0) result = 166;
            result += day;
        }
        if (hour > 0) {
            if (Math.floor(hour / 12) > 0) {
                if (result == 0) result = 143;
                result += (hour % 12) * 2;
                result += Math.floor(minute / 30);
                minute = 0;
            } else {
                result += (hour * 12) - 1;
                if (minute > 0) result++;
            }
        }
        if (minute > 0) {
            result += Math.floor(minute / 5) - 1;
        }
        return result;
    }

    validityToText(value) {
    }

    decode(PDU) {
        /*
        The following example shows how to send the message "hellohello" in the PDU mode from a Nokia 6110.

        AT+CMGF=0    'Set PDU mode
        AT+CSMS=0    'Check if modem supports SMS commands
        AT+CMGS=23   'Send message, 23 octets (excluding the two initial zeros)
        >0011000B916407281553F80000AA0AE8329BFD4697D9EC37<ctrl-z>

        There are 23 octets in this message (46 'characters'). The first octet ("00") doesn't count, it is only an indicator of the length of
        the SMSC information supplied (0). The PDU string consists of the following:

        Octet(s)            Description
        00                  Length of SMSC information. Here the length is 0, which means that the SMSC stored in the phone should be used.
                            Note: This octet is optional. On some phones this octet should be omitted! (Using the SMSC stored in phone is thus implicit)
        11                  First octet of the SMS-SUBMIT message.
        00                  TP-Message-Reference. The "00" value here lets the phone set the message reference number itself.
        0B                  Address-Length. Length of phone number (11)
        91                  Type-of-Address. (91 indicates international format of the phone number).
        6407281553F8        The phone number in semi octets (46708251358). The length of the phone number is odd (11), therefore a trailing
                            F has been added, as if the phone number were "46708251358F". Using the unknown format (i.e. the Type-of-Address
                            81 instead of 91) would yield the phone number octet sequence 7080523185 (0708251358). Note that this has the
                            length 10 (A), which is even.
        00                  TP-PID. Protocol identifier
        00                  TP-DCS. Data coding scheme.This message is coded according to the 7bit default alphabet. Having "04" instead of
                            "00" here, would indicate that the TP-User-Data field of this message should be interpreted as 8bit rather than
                            7bit (used in e.g. smart messaging, OTA provisioning etc).
        AA                  TP-Validity-Period. "AA" means 4 days. Note: This octet is optional, see bits 4 and 3 of the first octet
        0A                  TP-User-Data-Length. Length of message. The TP-DCS field indicated 7-bit data, so the length here is the number of
                            septets (10). If the TP-DCS field were set to 8-bit data or Unicode, the length would be the number of octets.
        E8329BFD4697D9EC37  TP-User-Data. These octets represent the message "hellohello". How to do the transformation from 7bit septets into
                            octets is shown here
        */
        let result;
        const seq = new CharSequence(PDU);
        try {
            let pduSize, pduType, len, smsc, dcs;
            // Check if PDU contain SMSC information
            try {
                len = parseInt('0x' + seq.read(2)) * 2;
            } catch (e) {
                len = 0;
            }
            if (len > 0) smsc = this.decodeNumber(seq.read(len));
            pduSize = ((PDU.length - len) / 2) - 1;
            // Check if SMS-Submit or SMS-Deliver
            /*
            First octet of the SMS-DELIVER PDU
            The first octet of the SMS-DELIVER PDU has the following layout:
    
            Bit no  7        6        5        4        3        2       1       0
            Name    TP-RP    TP-UDHI  TP-SRI   (unused) (unused) TP-MMS  TP-MTI  TP-MTI
    
            Name    Meaning
            TP-RP   Reply path. Parameter indicating that reply path exists.
            TP-UDHI User data header indicator. This bit is set to 1 if the User Data field starts with a header
            TP-SRI  Status report indication. This bit is set to 1 if a status report is going to be returned to the SME
            TP-MMS  More messages to send. This bit is set to 0 if there are more messages to send
            TP-MTI  Message type indicator. Bits no 1 and 0 are both set to 0 to indicate that this PDU is an SMS-DELIVER
            */
            try {
                pduType = parseInt('0x' + seq.read(2));
            } catch (e) {
                pduType = 0;
            }
            let isSubmit = (pduType & 3) == 1;
            let isReport = (pduType & 3) == 2;
            result = !isReport ? new ntAtSmsMessage() : new ntAtSmsStatusReport();
            result.pdu = PDU;
            result.tplen = pduSize;
            result.submit = isSubmit;
            result.smsc = smsc;
            // Check there are Header Information
            result.udh = this.bitSet(pduType, BIT_6);
            // Message reference
            if (isSubmit || isReport) {
                result.messageReference = parseInt('0x' + seq.read(2));
            }
            if (isSubmit) {
                result.statusRequest = this.bitSet(pduType, BIT_5);
            }
            // Get Sender Field Length and Startpos
            try {
                len = parseInt('0x' + seq.read(2));
            } catch (e) {
                len = 0;
            }
            if ((len % 2) > 0) len++;
            len += 2;
            result.address = this.decodeNumber(seq.read(len));
            if (!isReport) {
                // Skip TP-PID
                seq.skip(2);
                /*
                The Type-of-Address octet indicates the format of a phone number. The most common value of this octet
                is 91 hex (10010001 bin), which indicates international format. A phone number in international format
                looks like 46708251358 (where the country code is 46). In the national (or unknown) format the same
                phone number would look like 0708251358. The international format is the most generic, and it has to
                be accepted also when the message is destined to a recipient in the same country as the MSC or as the SGSN.
    
                Using the unknown format (i.e. the Type-of-Address 81 instead of 91) would yield the phone number octet
                sequence 7080523185 (0708251358). Note that this has the length 10 (A), which is even.
                */
                try {
                    dcs = parseInt('0x' + seq.read(2));
                } catch (e) {
                    dcs = 0;
                }
                /*
                Should check DCS for $00abxxzz, where
                    a = compression flag
                    b = message class meaning
                    xx = message data coding
                    zz = message class
    
                So we are going to check bits 2 and 3 only ($00001100 = $C)
                */
                result.dcs = (dcs & 0x0c) >> 2;
                // Get Validity Field Length
                if (isSubmit) {
                    /*
                    VPF  bit4 bit3  Validity Period
                         0    0     VP field is not present
                         0    1     VP field present an semi-octet represented (enhanced)
                         1    0     VP field present an integer represented (relative)
                         1    1     VP field present an semi-octet represented (absolute)
                    */
                    result.validityPeriod = (pduType & 0x18) >> 3;
                    switch (result.validityPeriod) {
                        case this.VALIDITY_PERIOD.VP_ENHANCED:
                        case this.VALIDITY_PERIOD.VP_SEMIOCTET:
                            len = 14;
                            break;
                        case this.VALIDITY_PERIOD.VP_INTEGER:
                            len = 2;
                            break;
                        default:
                            len = 0;
                    }
                    if (len > 0) {
                        result.validity = this.decodeValidity(result.validityPeriod, seq.read(len));
                    }
                } else {
                    result.time = this.decodeTimeStamp(seq.read(14));
                }
                result.decodeMessage(seq.read(0));
            } else {
                /*
                Service center timestamp >
                Parameter identifying time when the SC received the previously sent SMS-SUBMIT
                */
                result.sentTime = this.decodeTimeStamp(seq.read(14));
                /*
                Discharge timestamp >
                Parameter identifying the time associated with a particular TP-ST outcome
                = time of successful delivery OR time of last delivery attempt
                */
                result.dischargeTime = this.decodeTimeStamp(seq.read(14));
                // Status itself
                result.status = parseInt('0x' + seq.read(2));
            }
        } catch (e) {
            console.log(e.message);
        }
        return result;
    }
}

/**
 * SMS message.
 */
class ntAtSmsMessage {

    constructor() {
        this.dcs = sms.CODING_SCHEME.CS_UNKNOWN;
        this.validityPeriod = sms.VALIDITY_PERIOD.VP_INTEGER;
        this.validity = sms.VALIDITY_1_DAY;
    }

    decodeMessage(message) {
        const seq = new CharSequence(message);
        let len, udhlen, msg;
        let zeroUdhi = '';
        // TP-User-Data-Length. Length of message. The TP-DCS field indicated 7-bit data, so the length here is the number
        // of septets. If the TP-DCS field were set to 8-bit data or Unicode, the length would be the number of octets.
        len = parseInt('0x' + seq.read(2));

        /* we can't just change original PDU
          - see Delete and Insert in 'if FUDHPresent' block */
    
        /* Sample PDU which is from Long SMS and doesn't contains UDHI!
    
          005143048101010000FFA00000000000005A20631A5F2683825650592E7F
          CB417774D90D2AE2E1ECB7BC2C0739DFE4B28B18A68741E939C89964BA1A
          8A16C898C697C9206B589E7ED7E7A07BDA4D7EDF41E4B2395C67D34173F4
          FB0E82BFE7697AFAED7635142D90318D2F9341D2329C1DCE83DE6E10F3ED
          3E83A6CD2948C47CBBCF2290B84EA7BFDDA0393D4C2FBB1A8A16C898C697
          C9
        */
        if (this.udh) {
            udhlen = parseInt('0x' + seq.read(2));
            zeroUdhi = '0'.repeat((udhlen + 1) * 2);
            this.udhi = this.decodeUdhi(seq.read(udhlen * 2));
        }
        switch (this.dcs) {
            case sms.CODING_SCHEME.CS_7BIT:
                msg = sms.gsmDecode7Bit(zeroUdhi + seq.read(0));
                if (this.udh) {
                    msg = msg.substr((udhlen / 7) + udhlen + 2, len);
                } else {
                    msg = msg.substr(0, len);
                }
                break;
            case sms.CODING_SCHEME.CS_8BIT:
                msg = sms.gsmDecode8Bit(seq.read(len * 2));
                break;
            case sms.CODING_SCHEME.CS_UCS2:
                msg = sms.gsmDecodeUcs2(seq.read(len * 2));
                break;
            default:
                break;
        }
        this.message = sms.makeCrLf(msg);
        return this;
    }

    encodeMessage(str, options) {
        options = options || {};
        // WARNING! GetPDU generates only SMS-SUBMIT type pdu !!
        try {
            let data = [];
            let udhlen = 0;
            let udhi;
            if (this.udhi) {
                udhi = new CharSequence(this.encodeUdhi());
                udhlen = parseInt('0x' + udhi.read(2));
            }
            if (this.dcs == sms.CODING_SCHEME.CS_UNKNOWN) {
                this.dcs = sms.detectCodingScheme(str);
            }
            this.isSubmit = true;
            this.time = new Date();
            this.message = str;
            /*
            Protocol Data Unit Type (PDU Type). Here $11 means:
            VPF  bit4 bit3  Validity Period = 1 0
                 0    0     VP field is not present
                 0    1     Reserved
            ->   1    0     VP field present an integer represented (relative)
                 1    1     VP field present an semi-octet represented (absolute)
            MTI  bit1 bit0  Message type = 0 1
                 0    0     SMS-DELIVER (SMSC ==> MS)
                 0    0     SMS-DELIVER REPORT (MS ==> SMSC, is generated automatically by the M20, after receiving a SMS-DELIVER)
            ->   0    1     SMS-SUBMIT (MS ==> SMSC)
                 0    1     SMS-SUBMIT REPORT (SMSC ==> MS)
                 1    0     SMS-STATUS REPORT (SMSC ==> MS)
                 1    0     SMS-COMMAND (MS ==> SMSC)
                 1    1     Reserved
            */
            // validity periode always set as integer
            let header = BIT_0 | BIT_4;
            /*
            SRR  bit5
                 0          A status report is not requested
                 1          A status report is requested }
            */
            if (options.requestStatus) header = header | BIT_5;
            /*
            UDHI bit6
                 0          The UD field contains only the short message
                 1          The beginning of the UD field contains a header in addition of the short message }
            */
            if (udhi) header = header | BIT_6;
            /*
            RP   bit7
                 0          Reply Path parameter is not set in this PDU
                 1          Reply Path parameter is set in this PDU }
            */
            if (options.requestReply) header = header | BIT_7;
            data.push(sms.hexPad(header.toString(16).toUpperCase(), 2));
            /*
            The MR field gives an integer (0..255) representation of a reference number of the SMS-SUBMIT
            submitted to the SMSC by the MS.
            */
            // Let the phone set Msg Ref itself
            data.push(sms.hexPad(0x0.toString(16).toUpperCase(), 2));
            // Convert Address (Destination No)
            data.push(sms.encodeNumber(this.address));
            /*
            The PID is the information element by which the Transport Layer either refers to the higher layer
            protocol being used, or indicates interworking with a certain type of telematic device.
            Here are some examples of PID codings:
            00H: The PDU has to be treat as a short message
            01H: The PDU has to be treat as a telex
            02H: The PDU has to be treat as group3 telefax
            03H: The PDU has to be treat as group4 telefax
            */
            data.push(sms.hexPad(0x0.toString(16).toUpperCase(), 2));
            /*
            Detect Data Coding Scheme (DCS)
            The TP-Data-Coding-Scheme field, defined in GSM 03.40, indicates the data coding scheme of the
            TP-UD field, and may indicate a message class. Any reserved codings shall be assumed to be the
            GSM default alphabet (the same as codepoint 00000000) by a receiving entity. The octet is used
            according to a coding group which is indicated in bits 7..4. The octet is then coded as follows:
            Bits 7..4 - 00xx
                Bit 7 Bit 6
                0 0 General Data Coding indication
                Bit 5
                0 Text is uncompressed
                1 Text is compressed (TODO - add compression support)
                Bit 4
                0 Bits 1 and 0 are reserved and have no message class meaning
                1 Bits 1 and 0 have a message class meaning
            Bits 3..0 - xxxx
                Bit 3 Bit 2 Alphabet being used
                0 0 Default alphabet
                0 1 8 bit data
                1 0 UCS2 (16bit)
                1 1 Reserved
                Bit 1 Bit 0 Message class Description
                0 0 Class 0 Immediate display (alert)
                0 1 Class 1 ME specific
                1 0 Class 2 SIM specific
                1 1 Class 3 TE specific
            The special case of bits 7..0 being 0000 0000 indicates the Default Alphabet as in Phase 2
            http://www.dreamfabric.com/sms/dcs.html
            */
            let dcs = 0;
            switch (this.dcs) {
                case sms.CODING_SCHEME.CS_7BIT:
                    break;
                case sms.CODING_SCHEME.CS_8BIT:
                    dcs = 0x4;
                    break;
                case sms.CODING_SCHEME.CS_UCS2:
                    dcs = 0x8;
                    break;
            }
            // Have a message class meaning Class 0 Immediate display (alert)
            if (options.flashMessage) dcs = dcs | BIT_4;
            data.push(sms.hexPad(dcs.toString(16).toUpperCase(), 2));
            // TPVP
            let validity = sms.validityIndex(this.validity);
            data.push(sms.hexPad(validity.toString(16).toUpperCase(), 2));
            /*
            TP-UDL. User data length, length of message. The TP-DCS field indicated  7-bit data, so the length
            here is the number of septets (10). If the TP-DCS  field were set to indicate 8-bit data or Unicode,
            the length would be the number of octets (9).
            */
            let msg = '';
            let msglen = 0;
            switch (this.dcs) {
                case sms.CODING_SCHEME.CS_7BIT:
                    if (udhi) {
                        udhlen = Math.floor(udhlen / 7) + udhlen + 2;
                        str = '@'.repeat(udhlen) + str;
                    }
                    msg = sms.gsmEncode7Bit(str);
                    msglen = sms.gsmLength7Bit(str);
                    if (udhi) {
                        // Remove excessive 7-bit padding
                        msg = msg.substr((udhlen - 1) * 2);
                    }
                    break;
                case sms.CODING_SCHEME.CS_8BIT:
                    if (udhi) udhlen++;
                    msg = sms.gsmEncode8Bit(str);
                    msglen = (msg.length / 2) + udhlen;
                    break;
                case sms.CODING_SCHEME.CS_UCS2:
                    if (udhi) udhlen++;
                    msg = sms.gsmEncodeUcs2(str);
                    msglen = (msg.length / 2) + udhlen;
                    break;
            }
            data.push(sms.hexPad(msglen.toString(16).toUpperCase(), 2));
            if (udhi) {
                data.push(udhi.restart().read(0));
            }
            data.push(msg);
            let pdu = data.join('');
            this.tplen = pdu.length / 2;
            /*
            If the “len“ field is set to Zero then use the default value of the Service Centre address set by
            the AT+CSCA command
            */
            let smsc = '';
            if (this.smsc) {
                smsc = sms.encodeNumber(this.smsc);
            }
            this.pdu = sms.hexPad((smsc.length / 2).toString(16).toUpperCase()) + smsc + pdu;
            return true;
        } catch (e) {
            console.log(e.message);
        }
        return false;
    }

    decodeUdhi(str) {
        const result = {};
        if (str) {
            result.data = str;
            const seq = new CharSequence(str);
            const id = seq.readInt(2);
            if (typeof id != 'undefined') {
                seq.read(2);
                result.reference = seq.readInt(id == sms.SMS_16BIT_REF ? 4 : 2);
                result.total = seq.readInt(2);
                result.index = seq.readInt(2);
            }
        }
        return result;
    }

    encodeUdhi(data) {
        let result = '';
        if (typeof data == 'undefined') {
            data = this.udhi || {};
        }
        if (typeof data.reference != 'undefined') {
            let type = data.reference > 0xff ? sms.SMS_16BIT_REF : sms.SMS_8BIT_REF;
            result = sms.hexPad(data.reference.toString(16).toUpperCase(),
                type == sms.SMS_16BIT_REF ? 4 : 2);
            result += sms.hexPad(data.total.toString(16).toUpperCase(), 2);
            result += sms.hexPad(data.index.toString(16).toUpperCase(), 2);
            result = sms.hexPad((result.length / 2).toString(16).toUpperCase(), 2) + result;
            result = sms.hexPad(type.toString(16).toUpperCase(), 2) + result;
            result = sms.hexPad((result.length / 2).toString(16).toUpperCase(), 2) + result;
        }
        return result;
    }

    getReference() {
        if (this.udhi && typeof this.udhi.reference != 'undefined') {
            return this.udhi.reference;
        }
        return null;
    }

    getIndex() {
        if (this.udhi && typeof this.udhi.index != 'undefined') {
            return this.udhi.index;
        }
        return null;
    }

    getTotal() {
        if (this.udhi && typeof this.udhi.total != 'undefined') {
            return this.udhi.total;
        }
        return null;
    }
}

/**
 * SMS status report.
 */
class ntAtSmsStatusReport {

    constructor() {
        this.status = null;
    }

    isDelivered() {
        /*
            bits 6-0
           Short message transaction completed
             0000000 Short message received by the SME
             0000001 Short message forwarded by the SC to the SME but the SC is
                     unable to confirm delivery
             0000010 Short message replaced by the SC
           Reserved values
             0000011..0001111 Reserved
             0010000..0011111 Values specific to each SC
           Temporary error, SC still trying to transfer SM
             0100000 Congestion
             0100001 SME busy
             0100010 No response from SME
             0100011 Service rejected
             0100100 Quality of service not available
             0100101 Error in SME
             0100110..0101111 Reserved
             0110000..0111111 Values specific to each SC
           Permanent error, SC is not making any more transfer attempts
             1000000 Remote procedure error
             1000001 Incompatible destination
             1000010 Connection rejected by SME
             1000011 Not obtainable
             1000100 Quality of service not available
             1000101 No interworking available
             1000110 SM Validity Period Expired  ($46)
             1000111 SM Deleted by originating SME
             1001000 SM Deleted by SC Administration
             1001001 SM does not exist (The SM may have previously existed in the SC but the SC
                     no longer has knowledge of it or the SM
                     may never have previously existed in the SC)
             1001010..1001111 Reserved
           Temporary error, SC is not making any more transfer attempts
             1100000 Congestion
             1100001 SME busy
             1100010 No response from SME
             1100011 Service rejected
             1100100 Quality of service not available
             1100101 Error in SME
             1100110..1101001 Reserved
             1101010..1101111 Reserved
             1110000..1111111 Values specific to each SC
        */
        return this.status == 0 ? true : false;
    }
}

sms = new ntAtSms();

module.exports = {
    ntAtSms: sms,
    ntAtSmsMessage: ntAtSmsMessage,
    ntAtSmsStatusReport: ntAtSmsStatusReport,
};
