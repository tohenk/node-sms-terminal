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

Token.split = function(str, options) {
    const result = this.doSplit(str, options);
    return result.tokens;
}

Token.doSplit = function(str, options) {
    options = options || {};
    const tokens = [];
    const delimeter = options.delimeter != undefined ? options.delimeter : this.SEP;
    const throwError = options.throwError != undefined ? options.throwError : false;
    const stopChar = options.stopChar != undefined ? options.stopChar : null;
    var i = 0, j = str.length - 1, cnt = 0, p = 0, s = 0;
    var started = false, enclosed = false, quoted = false, stopped = false;
    var lastchar = null, part = null;
    // s => the start position of next check
    // p => the last position of checked
    // i => the start position of checked
    const next = () => {
        if (null == stopChar) {
            p = str.indexOf(delimeter, s);
            if (p < 0) p = j + 1;
        } else {
            while (true) {
                if (p > j) break;
                if (str.charAt(p) == delimeter) break;
                if (str.charAt(p) == stopChar) break;
                p++;
            }
        }
    }
    const add = () => {
        if (null == part) {
            part = str.substr(i, p - i);
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
        }
        if (typeof part == 'string' && part.length == 0) part = undefined;
        tokens.push(part);
    }
    while (true) {
        if (i > j || stopped) {
            if (lastchar == delimeter) {
                if (throwError) {
                    throw new Error('Missing token at end: ' + str);
                } else {
                    add();
                }
            }
            break;
        }
        if (!started) {
            stopped = null != stopChar && str.charAt(i) == stopChar ? true : false;
            if (stopped) {
                s = i;
                continue;
            }
            enclosed = str.charAt(i) == '(';
            quoted = str.charAt(i) == this.Q;
            if (enclosed || quoted) i++;
            s = i;
            p = s;
            started = true;
        }
        if (started) {
            part = null;
            if (quoted) {
                while (true) {
                    p = str.indexOf(this.Q, s);
                    if (p < 0) {
                        if (throwError) {
                            throw new Error('Unterminated quote ' + str.substr(s - 1));
                        } else {
                            p = j + 1;
                            break;
                        }
                    }
                    if (p == j) {
                        break;
                    }
                    // check for quote escape
                    if (p < j) {
                        if (str.charAt(p + 1) != this.Q) {
                            // not a quote escape
                            break;
                        } else {
                            // continue, its a quote escape
                            s = p + 2;
                        }
                    }
                }
            }
            if (enclosed) {
                var result = this.doSplit(str.substr(s), {delimeter: delimeter, throwError: throwError, stopChar: ')'});
                part = result.tokens;
                p = s + result.position + 1;
                while (str.charAt(p + 1) == delimeter) p++;
            }
            if (!quoted && !enclosed) next();
            add();
            // p now equal to delimeter
            lastchar = str.charAt(p);
            i = p;
            started = false;
            if (null !== stopChar && lastchar == stopChar) continue;
            i++;
            while (str.charAt(i) == ' ') i++;
        }
    }
    return {
        tokens: tokens,
        position: i
    }
}
