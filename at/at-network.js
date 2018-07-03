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
 * AT GSM network processor.
 */

const ntAtNetwork = module.exports = exports;

ntAtNetwork.GSM_NETWORK_AUTOMATIC       = 0;
ntAtNetwork.GSM_NETWORK_MANUAL          = 1;
ntAtNetwork.GSM_NETWORK_DEREGISTER      = 2;
ntAtNetwork.GSM_NETWORK_SET_FORMAT      = 3;
ntAtNetwork.GSM_NETWORK_MANUAL_AUTO     = 4;

ntAtNetwork.GSM_FORMAT_LONG_ALPHA       = 0;
ntAtNetwork.GSM_FORMAT_SHORT_ALPHA      = 1;
ntAtNetwork.GSM_FORMAT_NUMERIC          = 2;

ntAtNetwork.GSM_STATUS_UNKNOWN          = 0;
ntAtNetwork.GSM_STATUS_AVAILABLE        = 1;
ntAtNetwork.GSM_STATUS_CURRENT          = 2;
ntAtNetwork.GSM_STATUS_FORBIDDEN        = 3;

ntAtNetwork.factory = function(code, mode, format, status) {
    this.code = code;
    this.mode = mode;
    this.format = format;
    this.status = status;
}

ntAtNetwork.from = function(a) {
    return new this.factory(a[2], a[0], a[1], a[3]);
}

ntAtNetwork.list = function(networks) {
    var items = [];
    for (var i = 0; i < networks.length; i++) {
        items.push(this.from(networks[i]));
    }
    return items;
}
