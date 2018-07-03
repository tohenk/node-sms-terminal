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

/**
 * Char sequence.
 */

CharSequence = function(str) {
    this.str = str;
    this.pos = 0;
    this.len = this.str.length;
}

CharSequence.prototype.read = function(len) {
    if (typeof len == 'undefined') {
        var len = 0;
    }
    if (len == 0) {
        var res = this.str.substr(this.pos);
    } else {
        var res = this.str.substr(this.pos, len);
    }
    this.pos += res.length;
    return res;
}

CharSequence.prototype.readInt = function(len) {
    var res = this.read(len);
    if (res) {
        return parseInt('0x' + res);
    }
}

CharSequence.prototype.skip = function(len) {
    this.pos += len;
    return this;
}

CharSequence.prototype.rewind = function(len) {
    this.pos -= len;
    return this;
}

CharSequence.prototype.restart = function() {
    this.pos = 0;
    return this;
}

CharSequence.prototype.eof = function() {
    return this.pos > this.len;
}

module.exports = exports = CharSequence;
