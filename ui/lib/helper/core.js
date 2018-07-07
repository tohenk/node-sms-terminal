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
 * Express core middleware.
 */

const script = require('./../script');

var Blocks = {};

function CoreHelper(options) {
    return (req, res, next) => {
        attachHelper(res);
        next();
    }
}

function attachHelper(res) {
    const app = res.app;
    if (!res.locals.script) {
        res.locals.script = script;
    }
    if (!res.locals.apptitle) {
        res.locals.apptitle = app.title;
    }
    if (!res._render) {
        res._render = res.render;
        res.render = (view, options) => {
            options = options || {};
            startRender();
            res._render(view, options, (err, str) => {
                if (err) return res.req.next(err);
                finishRender();
                var layout = res.locals.layout || app.locals.layout || 'default';
                var title = options.title || '';
                var sitetitle = app.title;
                if (title) sitetitle = `${title} &ndash; ${sitetitle}`;
                if (false !== layout) {
                    const values = {
                        sitetitle: sitetitle,
                        stylesheets: script.getAssets(script.Asset.STYLESHEET),
                        javascripts: script.getAssets(script.Asset.JAVASCRIPT),
                        title: title,
                        content: str,
                        scripts: script.getContent()
                    }
                    Object.assign(values, Blocks);
                    res._render(`layout/${layout}`, values, (err, str) => {
                        if (err) return res.req.next(err);
                        res.send(str);
                    });
                } else {
                    res.send(str);
                }
            });
        }
    }
    if (!res.locals.block) {
        res.locals.block = (name, content) => {
            if (content == undefined) {
                return Blocks[name] ? Blocks[name] : '';
            } else {
                Blocks[name] = content;
            }
        }
    }
}

function startRender() {
    script.clear();
    script.includeDefaults();
    Blocks = {};
}

function finishRender() {
    script.includeAssets();
}

module.exports = CoreHelper;