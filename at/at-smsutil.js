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
 * SMS helper utilities, originally taken from https://sourceforge.net/projects/fma/.
 */

const ntAtSmsUtil = module.exports = exports;

ntAtSmsUtil.Alphabet7Escape = 0x1b; // 27

/*
  The ETSI GSM 03.38 specification shows an uppercase C-cedilla (code 199)
  glyph at 0x09. This may be the result of limited display
  capabilities for handling characters with descenders. However, the
  language coverage intent is clearly for the lowercase c-cedilla
  which has code 231 (see mapping 09th).
*/

ntAtSmsUtil.Alphabet7Bit = [
/*        0      1      2      3      4      5      6      7      8      9      A      B      C      D      E      F */
/*0*/    64,   163,    36,   165,   232,   233,   249,   236,   242,   199,    10,   216,   248,    13,   197,   229,
/*1*/ 0x394,    95, 0x3A6, 0x393, 0x39B, 0x3A9, 0x3A0, 0x3A8, 0x3A3, 0x398, 0x39E,    27,   198,   230,   223,   201,
/*2*/    32,    33,    34,    35,   164,    37,    38,    39,    40,    41,    42,    43,    44,    45,    46,    47,
/*3*/    48,    49,    50,    51,    52,    53,    54,    55,    56,    57,    58,    59,    60,    61,    62,    63,
/*4*/   161,    65,    66,    67,    68,    69,    70,    71,    72,    73,    74,    75,    76,    77,    78,    79,
/*5*/    80,    81,    82,    83,    84,    85,    86,    87,    88,    89,    90,   196,   214,   209,   220,   167,
/*6*/   191,    97,    98,    99,   100,   101,   102,   103,   104,   105,   106,   107,   108,   109,   110,   111,
/*7*/   112,   113,   114,   115,   116,   117,   118,   119,   120,   121,   122,   228,   246,   241,   252,   224];

ntAtSmsUtil.Alphabet7Map = {
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

ntAtSmsUtil.getAlphabet7MapKeys = function() {
    return Object.keys(this.Alphabet7Map).map(key => parseInt(key)).filter(key => key > 0);
}

ntAtSmsUtil.getAlphabet7MapChar = function(char) {
    char = char.toString();
    if (this.Alphabet7Map[char]) {
        return this.Alphabet7Map[char];
    }
}

ntAtSmsUtil.getAlphabet7MapKey = function(char) {
    var result;
    Object.keys(this.Alphabet7Map).forEach((key) => {
        if (this.Alphabet7Map[key] == char) {
            result = parseInt(key);
            return true;
        }
    })
    return result;
}

// 7BIT helper functions

ntAtSmsUtil.unpack7Bit = function(value) {
    var septet = '';
    var len = Math.round(value.length / 2) - 1;
    var x = 1;
    var leftover = 0;
    for (var i = 0; i <= len; i++) {
        var c = value.substr(i * 2, 2);
        if (!this.isHexChar(c.charAt(0))) break;
        if (c.length == 2 && !this.isHexChar(c.charAt(1))) {
            c = c.charAt(0);
        }
        var octet = parseInt('0x' + c);
        var char = ((octet & (0xff >> x)) << (x - 1)) | leftover;
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

ntAtSmsUtil.pack7Bit = function(value) {
    var octet = '';
    var len = value.length;
    var x = 0;
    var nextChar = 0;
    var char;
    for (var i = 0; i < len; i++) {
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

ntAtSmsUtil.alphabetIndex7Bit = function(char) {
    return this.Alphabet7Bit.indexOf(char);
}

ntAtSmsUtil.escapeIndex7Bit = function(char) {
    const indexedChar = this.getAlphabet7MapKeys();
    if (indexedChar.indexOf(char) >= 0) {
        return char;
    } else {
        return -1;
    }
}

ntAtSmsUtil.is7Bit = function(char) {
    return (this.alphabetIndex7Bit(char) > -1 || this.escapeIndex7Bit(char) > -1) ? true : false;
}

ntAtSmsUtil.encode7Bit = function(value) {
    var septet = '';
    for (var i = 0; i < value.length; i++) {
        var char = this.alphabetIndex7Bit(value.charCodeAt(i));
        if (char == -1) {
            char = this.escapeIndex7Bit(value.charCodeAt(i));
            var mapped = this.getAlphabet7MapChar(char);
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

// 7BIT

ntAtSmsUtil.gsmLength7Bit = function(value) {
    return this.encode7Bit(value).length;
}

ntAtSmsUtil.gsmDecode7Bit = function(value) {
    var result = '';
    var value = this.unpack7Bit(value);
    var i = 0;
    while (true) {
        if (i == value.length) break;
        var v = value.charCodeAt(i);
        var char = v <= this.Alphabet7Bit.length ? v : 0;
        if (v == this.Alphabet7Escape) {
            i++;
            if (i == value.length) break;
            /*
              The ESC character 0x1B is mapped to the no-break space character, unless it is part of a
              valid ESC sequence, to facilitate round-trip compatibility in the presence of unknown ESC
              sequences.
            */
            var mapped = this.getAlphabet7MapKey(value.charCodeAt(i));
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
                var k = i + 2;
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

ntAtSmsUtil.gsmEncode7Bit = function(value) {
    return this.pack7Bit(this.encode7Bit(value))
}

// 8BIT

ntAtSmsUtil.gsmDecode8Bit = function(value) {
    var result = '';
    if ((value.length % 2) > 0) {
        var value = value + '0';
    }
    for (var i = 0; i < (value.length / 2) - 1; i++) {
        result += String.fromCharCode(value.substr(i * 2, 2));
    }
    return result;
}

ntAtSmsUtil.gsmEncode8Bit = function(value) {
    var result = '';
    for (var i = 0; i < value.length; i++) {
        char = value.charCodeAt(i);
        if (char > 255) {
            throw new Error('Unable to use 8bit encoding!');
        }
        result =+ char.toString(16).toUpperCase();
    }
    return result;
}

// UCS2

ntAtSmsUtil.gsmDecodeUcs2 = function(value) {
    // Convert HEX string sequence to UCS2
    while ((value.length % 4) > 0) value += '0';
    const len = value.length / 4;
    const buff = new Uint16Array(len);
    for (var i = 0; i < len; i++) {
        buff[i] = parseInt('0x' + value.substr(i * 4, 4));
    }
    return Buffer.from(buff).toString();
}

ntAtSmsUtil.gsmEncodeUcs2 = function(value) {
    var result = '';
    for (var i = 0; i < value.length; i++) {
        var char = this.hexPad(value.charCodeAt(i).toString(16).toUpperCase(), 4);
        result += char;
    }
    return result;
}

// utility

ntAtSmsUtil.isHexChar = function(s) {
    return s.match(/[a-zA-Z0-9]/) ? true : false;
}

ntAtSmsUtil.hexPad = function(s, len) {
    if (typeof len == 'undefined') {
        var len = 2;
    }
    while ((s.length % len) > 0) s = '0' + s;
    return s;
}

ntAtSmsUtil.bitSet = function(value, bit) {
    return (value & bit) == bit ? true : false;
}
