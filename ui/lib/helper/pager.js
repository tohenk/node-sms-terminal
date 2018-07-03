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
 * Express pager middleware.
 */

function PagerHelper(options) {
    return (req, res, next) => {
        attachHelper(res);
        next();
    }
}

function attachHelper(res) {
    if (!res.pager) {
        res.pager = getPager;
    }
}

function addPage(page, icon) {
    const result = {};
    result.page = page;
    if (icon) result.icon = icon;
    return result;
}

function getPager(count, size, page) {
    const result = [];
    const len = 5;
    const half = Math.floor(len / 2);
    var pages = Math.floor(count / size);
    if ((count % size) > 0) pages++;
    if (pages > 1) {
        var c = 0;
        var start = Math.max(1, Math.min(page - half, pages - len < 0 ? 1 : pages));
        if (pages - start < len) start = Math.max(1, pages - len + 1);
        for (var i = start; i <= pages; i++) {
            if (c >= len) break;
            result.push(addPage(i));
            c++;
        }
        if (page > 1) {
            result.unshift(addPage(page - 1, 'angle left icon'));
        }
        if (start > 1) {
            result.unshift(addPage(1, 'angle double left icon'));
        }
        if (page < pages) {
            result.push(addPage(++page, 'angle right icon'));
        }
        if (start + c - 1 < pages) {
            result.push(addPage(pages, 'angle double right icon'));
        }
    }
    return result;
}

module.exports = PagerHelper;