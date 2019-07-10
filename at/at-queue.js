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
 * AT queue event emitter.
 */

const ntAtQueue     = module.exports = exports;

const EventEmitter  = require('events');
const util          = require('util');

// queue

ntAtQueue.queue = function(queues, handler, check) {
    EventEmitter.call(this);
    this.queues = queues;
    this.handler = handler;
    this.check = check;
    this.next();
}

util.inherits(ntAtQueue.queue, EventEmitter);

ntAtQueue.queue.prototype.applyHandler = function() {
    this.once('queue', this.handler);
}

ntAtQueue.queue.prototype.start = function() {
    process.nextTick(() => {
        if (this.queues.length) {
            const queue = this.queues.shift();
            this.emit('queue', queue);
        }
    });
}

ntAtQueue.queue.prototype.next = function() {
    if (this.queues.length) {
        if (this.pending) return;
        if (typeof this.check == 'function') {
            if (!this.check()) return;
        }
        this.applyHandler();
        this.start();
    } else {
        this.done();
    }
}

ntAtQueue.queue.prototype.done = function() {
    process.nextTick(() => {
        this.emit('done');
    });
}

ntAtQueue.queue.prototype.requeue = function(queues) {
    const processNext = this.queues.length == 0;
    Array.prototype.push.apply(this.queues, queues);
    if (processNext) this.next();
}

// work

ntAtQueue.work = function(works) {
    EventEmitter.call(this);
    this.works = works;
    this.start();
}

util.inherits(ntAtQueue.work, EventEmitter);

ntAtQueue.work.prototype.start = function() {
    process.nextTick(() => {
        if (this.works.length) {
            const work = this.works.shift();
            this.emit('work', work);
        }
    });
}

ntAtQueue.works = function(workers) {
    var w = new ntAtQueue.work(workers);
    return new Promise((resolve, reject) => {
        var f = (worker) => {
            try {
                worker().then(() => {
                    if (w.works.length == 0) {
                        resolve();
                    } else {
                        w.once('work', f);
                        w.start();
                    }
                }).catch((err) => {
                    reject(err);
                });
            } catch(e) {
                console.log(e.message);
                reject(e.message);
            }
        }
        w.once('work', f);
    });
}
