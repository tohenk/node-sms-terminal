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
 * Common queue handler.
 */

const AppQueue      = module.exports = exports;

const EventEmitter  = require('events');
const util          = require('util');

AppQueue.Queue = function(queues, handler) {
    EventEmitter.call(this);
    this.queues = queues;
    this.handler = handler;
    this.next();
}

util.inherits(AppQueue.Queue, EventEmitter);

AppQueue.Queue.prototype.start = function() {
    process.nextTick(() => {
        if (this.queues.length) {
            const queue = this.queues.shift();
            this.emit('queue', queue);
        }
    });
}

AppQueue.Queue.prototype.next = function() {
    if (this.queues.length) {
        this.applyHandler();
        this.start();
    } else {
        this.done();
    }
}

AppQueue.Queue.prototype.done = function() {
    process.nextTick(() => {
        this.emit('done');
    });
}

AppQueue.Queue.prototype.applyHandler = function() {
    this.once('queue', this.handler);
}
