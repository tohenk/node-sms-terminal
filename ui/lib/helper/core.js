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

const path = require('path');
const script = require('./../script');

var Blocks = {};
var finalized = false;

function CoreHelper(options) {
    return (req, res, next) => {
        applyAppHelper(req.app);
        applyHelper(req, res);
        next();
    }
}

function applyAppHelper(app) {
    if (!app.locals.apptitle) {
        app.locals.apptitle = app.title;
    }
    if (!app.locals.slot) {
        app.locals.slot = (name) => {
            if (app.slots) {
                var slot = app.slots[name];
                if (slot) {
                    if (typeof slot == 'object') {
                        if (false == slot.enabled) {
                            delete slot.enabled;
                            return;
                        }
                        if (slot.view) {
                            slot = slot.view;
                        }
                    }
                    return slot;
                }
            }
        }
    }
    if (!app.locals.block) {
        app.locals.block = (name, content) => {
            if (content == undefined) {
                return Blocks[name] ? Blocks[name] : '';
            } else {
                Blocks[name] = content;
            }
        }
    }
    if (!app.locals.script) {
        app.locals.script = script;
    }
    if (!app.locals.scripts) {
        app.locals.scripts = () => {
            return script.getContent();
        }
    }
    if (!app.locals.javascripts) {
        app.locals.javascripts = () => {
            finalizeVars();
            return script.getAssets(script.Asset.JAVASCRIPT);
        }
    }
    if (!app.locals.stylesheets) {
        app.locals.stylesheets = () => {
            finalizeVars();
            return script.getAssets(script.Asset.STYLESHEET);
        }
    }
    if (!app.locals.jsloader) {
        app.locals.jsloader = (assets) => {
            const loader = require('./../script/Loader').instance().getScript();
            const queues = JSON.stringify(assets, null, 4);
            return `<script type="text/javascript">
//<![CDATA[
${loader}
// load all assets
document.ntloader.load(${queues});
//]]>
</script>
`;
        }
    }
}

function applyHelper(req, res) {
    resetVars();
    if (!res._render) {
        res._render = res.render;
        res.render = (view, options) => {
            options = options || {};
            if (res.locals.viewdir) view = path.join(res.locals.viewdir, view);
            res._render(view, options, (err, str) => {
                if (err) {
                    return res.req.next(err);
                }
                res.renderLayout(str, options);
            });
        }
    }
    if (!res.renderLayout) {
        res.renderLayout = (content, options) => {
            var layout = req.xhr ? 'xhr' : 'default';
            if (res.locals.layout !== undefined) {
                layout = res.locals.layout;
            } else if (res.app.locals.layout !== undefined) {
                layout = res.app.locals.layout;
            }
            var title = options.title || '';
            var sitetitle = res.app.title;
            if (title) sitetitle = `${title} &ndash; ${sitetitle}`;
            if (false !== layout) {
                const values = {
                    sitetitle: sitetitle,
                    title: title,
                    content: content
                }
                Object.assign(values, Blocks);
                res.app.render(`layout/${layout}`, values, (err, str) => {
                    if (err) {
                        return res.req.next(err);
                    }
                    res.send(str);
                });
            } else {
                res.send(str);
            }
        }
    }
}

function resetVars() {
    finalized = false;
    script.clear();
    script.includeDefaults();
    Blocks = {};
}

function finalizeVars() {
    if (!finalized) {
        finalized = true;
        script.includeAssets();
    }
}

module.exports = CoreHelper;