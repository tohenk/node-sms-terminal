/**
 * Copyright (c) 2016-2017 Toha <tohenk@yahoo.com>
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
 * Token utility
 */

const Token = module.exports = exports;

Token.Q = '"';
Token.SEP = ',';
Token.quote = function(str) {
    if (str.length) {
        var str = this.Q + str.replace(this.Q, this.Q + this.Q) + this.Q;
    }
    return str;
}
Token.split = function(str, delimeter) {
    var tokens = [];
    var delimeter = delimeter != undefined ? delimeter : Token.SEP;
    var i = 0, j = str.length - 1, cnt = 0, p = 0, s = 0;
    var started = false, enclosed = false, quoted = false;
    var lastchar = null;
    // s => the start position of next check
    // p => the last position of checked
    // i => the start position of checked
    const next = () => {
        p = str.indexOf(delimeter, s);
        if (p < 0) p = j + 1;
    }
    const add = () => {
        var part = str.substr(i, p - i);
        if (enclosed) part = this.split(part, delimeter);
        if (quoted) {
            part = part.replace(this.Q + this.Q, this.Q);
            next();
        } else if (part.length && !isNaN(part)) {
            if (part.indexOf('.') >= 0) {
                part = parseFloat(part);
            } else {
                part = parseInt(part);
            }
        }
        if (part == '') part = undefined;
        tokens.push(part);
    }
    while (true) {
        if (i > j) {
            if (lastchar == delimeter) add();
            break;
        }
        if (!started) {
            started = true;
            cnt = 0;
            enclosed = str.charAt(i) == '(';
            if (enclosed) {
                i++;
                cnt++;
            } else {
                quoted = str.charAt(i) == this.Q;
                if (quoted) i++;
            }
            s = i;
            p = s;
        }
        if (started) {
            if (quoted) {
                while (true) {
                    p = str.indexOf(this.Q, s);
                    if (p < 0 || p == j) {
                        p = j;
                        break;
                    }
                    if (p < j) {
                        if (str.charAt(p + 1) != this.Q) {
                            break;
                        } else {
                            s = p + 2;
                        }
                    }
                }
            }
            if (enclosed) {
                if (quoted) p++;
                quoted = str.charAt(p) == this.Q;
                if (quoted) {
                    p++;
                    s = p;
                    continue;
                }
                if (str.charAt(p) == delimeter) {
                    p++;
                    s = p;
                    continue;
                }
                while (cnt > 0) {
                    if (str.charAt(p) == '(') cnt++;
                    if (str.charAt(p) == ')') cnt--;
                    if (cnt > 0) p++;
                }
            }
            if (!quoted && !enclosed) next();
            add();
            // p now equal to delimeter
            lastchar = str.charAt(p);
            i = p + 1;
            while (str.charAt(i) == ' ') i++;
            started = false;
        }
    }
    return tokens;
}
