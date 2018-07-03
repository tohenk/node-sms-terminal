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
 * Express menu middleware.
 */

function MenuHelper(options) {
    return (req, res, next) => {
        attachHelper(res);
        next();
    }
}

function attachHelper(res) {
    if (!res.locals.mainmenu) {
        res.locals.menu = (items, options) => {
            return buildMenu(items, options);
        }
    }
}

function buildMenu(items, options) {
    var result = '';
    var options = options || {};
    var level = options.level || 0;
    var indent = options.indentation || 0;
    Object.keys(items).forEach((id) => {
        const item = items[id];
        const content = buildMenuItem(item, id, level);
        if (result.length) result += '\n';
        result += content;
    });
    if (result.length) {
        result = indentLines(result, 1);
    }
    if (options.mainmenu) {
        var contclass = 'ui container';
    } else {
        var contclass = options.containerclass || 'menu';
    }
    result = `<div class="${contclass}">
${result}
</div>`;
    if (indent > 0) {
        result = indentLines(result, indent);
    }
    return result;
}

function buildMenuItem(item, id, level) {
    var result = '';
    var title = item.title;
    var mclass = 'item';
    if (item.items) {
        var mclass = 'ui simple dropdown item';
        if (level > 0) {
            title = '<i class="dropdown icon"></i> ' + title;
        } else {
            title += ' <i class="dropdown icon"></i>';
        }
        title += '\n' + buildMenu(item.items, {level: level + 1, indentation: 1});
        title += '\n';
    } else {
        switch (item.type) {
            case 'brand':
                mclass = 'header item';
                title = `<img class="logo" src="${item.logo}">
${title}`;
                break;
            case 'divider':
                mclass = 'divider';
                title = '';
                break;
            case 'header':
                mclass = 'header';
                break;
        }
    }
    if (item.class) mclass = item.class + ' ' + mclass;
    mclass = `menu-${id} ${mclass}`;
    const clickable = !item.items && item.url;
    if (clickable) {
        var result = `<a href="${item.url}" class="${mclass}">${title}</a>`;
    } else {
        var result = `<div class="${mclass}">${title}</div>`;
    }
    return result;
}

function indentLines(lines, size) {
    const result = lines.split('\n').map((line) => {
        if (line.length) {
            line = ' '.repeat(size * 2) + line;
        }
        return line;
    });
    return result.join('\n');
}

module.exports = MenuHelper;