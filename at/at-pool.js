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
 * AT modems pool.
 */

const ntAtPool      = module.exports = exports;

const ntAtDrv       = require('./at-driver');
const ntAtGsm       = require('./at-gsm');

ntAtPool.Driver = ntAtDrv;

ntAtPool.init = function(factory, config) {
    this.items = {};
    this.streamFactory = factory;
    this.config = config;
}

ntAtPool.open = function(streamName) {
    var gsm = this.get(streamName);
    if (gsm) {
        return new Promise((resolve, reject) => {
            resolve(gsm);
        });
    }
    if (typeof this.streamFactory == 'function') {
        return new Promise((resolve, reject) => {
            this.streamFactory(streamName).then((stream) => {
                console.log('%s: Try detecting modem...', streamName);
                return new ntAtGsm.factory(streamName, stream, this.config);
            }).then((gsm) => {
                gsm.detect().then((driver) => {
                    console.log('%s: Modem successfully detected as %s.', streamName, driver.desc);
                    gsm.initialize().then(() => {
                        this.items[streamName] = gsm;
                        console.log('%s: Modem information:', streamName);
                        console.log('-'.repeat(50));
                        console.log('Manufacturer       = %s', gsm.info.manufacturer);
                        console.log('Model              = %s', gsm.info.model);
                        console.log('Version            = %s', gsm.info.version);
                        console.log('Serial             = %s', gsm.info.serial);
                        console.log('IMSI               = %s', gsm.info.imsi);
                        console.log('Call monitor       = %s', gsm.info.hasCall ? 'yes' : 'no');
                        console.log('SMS monitor        = %s', gsm.info.hasSms ? 'yes' : 'no');
                        console.log('USSD monitor       = %s', gsm.info.hasUssd ? 'yes' : 'no');
                        console.log('Charsets           = %s', gsm.props.charsets.join(', '));
                        console.log('Default charset    = %s', gsm.props.charset);
                        console.log('SMS Mode           = %s', gsm.props.smsMode);
                        console.log('Default storage    = %s', gsm.props.storage);
                        console.log('SMSC               = %s', gsm.props.smsc);
                        console.log('Network operator   = %s', gsm.props.network.code);
                        console.log('-'.repeat(50));
                        resolve(gsm);
                    }).catch((err) => {
                        reject(err);
                    });
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
        });
    } else {
        return new Promise((resolve, reject) => {
            reject('Stream factory is not avaliable.');
        });
    }
}

ntAtPool.get = function(streamName) {
    if (this.items[streamName]) {
        return this.items[streamName];
    }
}