/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2018-2020 Toha <tohenk@yahoo.com>
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

const path          = require('path');
const Sequelize     = require('sequelize');
const { ntAtSms }   = require('./at/at-sms');
const ntQueue       = require('./lib/queue');

/**
 * App storage.
 */
class AppStorage {

    DIR_OUT = 0
    DIR_IN = 1

    ACTIVITY_CALL = 1
    ACTIVITY_RING = 2
    ACTIVITY_SMS = 3
    ACTIVITY_INBOX = 4
    ACTIVITY_USSD = 5
    ACTIVITY_CUSD = 6

    init(options) {
        return new Promise((resolve, reject) => {
            this.db = new Sequelize(options);
            this.Activity = require('./model/Activity')(this.db);
            this.Pdu = require('./model/Pdu')(this.db);
            this.PduReport = require('./model/PduReport')(this.db);
            this.db.authenticate()
                .then(() => resolve())
                .catch((err) => reject(err))
            ;
        });
    }

    saveActivity(origin, activity, done) {
        const condition = {
            imsi: origin,
            hash: activity.hash,
            type: activity.type,
            address: activity.address
        }
        this.Activity.count({where: condition})
            .then((count) => {
                if (0 == count) {
                    if (!activity.imsi) activity.imsi = origin;
                    if (!activity.status) activity.status = 0;
                    if (!activity.time) activity.time = new Date();
                    if (typeof activity.data == 'string' && activity.data.length == 0) activity.data = null;
                    this.Activity.create(activity)
                        .then((result) => {
                            if (typeof done == 'function') {
                                done(result);
                            }
                        })
                    ;
                } else {
                    this.Activity.findOne({where: condition})
                        .then((result) => {
                            if (typeof activity.status != 'undefined' && result.status != activity.status) {
                                result.update({status: activity.status});
                            }
                        })
                    ;
                }
            })
        ;
    }

    savePdu(origin, msg, done) {
        const dir = msg.isSubmit ? this.DIR_OUT : this.DIR_IN;
        const mr = typeof msg.messageReference != 'undefined' ? msg.messageReference : null;
        const conditions = {imsi: origin, pdu: msg.pdu, dir: dir};
        if (dir == this.DIR_OUT) {
            conditions.mr = mr;
        }
        this.Pdu.count({where: conditions})
            .then((count) => {
                if (count == 0) {
                    this.Pdu.create({
                            hash: msg.hash,
                            imsi: origin,
                            dir: dir,
                            address: msg.address,
                            pdu: msg.pdu,
                            mr: mr,
                            time: new Date()
                        })
                        .then((pdu) => {
                            if (typeof done == 'function') {
                                done(pdu);
                            }
                        })
                    ;
                }
            })
        ;
    }

    saveReport(origin, msg, done) {
        this.PduReport.count({where: {imsi: origin, pdu: msg.pdu}})
            .then((count) => {
                if (count == 0) {
                    return this.PduReport.create({
                        imsi: origin,
                        pdu: msg.pdu,
                        time: new Date()
                    });
                }
                return true;
            })
            .then(() => {
                this.updateReport(origin, msg, true, done);
            })
        ;
    }

    updateReport(origin, report, update, done) {
        let msg;
        if (report instanceof this.PduReport) {
            msg = ntAtSms.decode(report.pdu);
        } else {
            msg = report;
        }
        this.Pdu.findAll({
            where: {imsi: origin, address: msg.address, dir: this.DIR_OUT, mr: msg.messageReference},
            order: [['time', 'DESC']]
        }).then((results) => {
            const status = {
                code: msg.status,
                sent: msg.sentTime,
                received: msg.dischargeTime
            }
            let hash;
            const q = new ntQueue(results, (Pdu) => {
                let matched = results.length == 1;
                if (!matched) {
                    let seconds = Math.abs(Math.floor((msg.sentTime - Pdu.time) / 1000));
                    if (seconds <= 1 * 24 * 60 * 60) matched = true;
                }
                if (matched) {
                    if (!hash) hash = Pdu.hash;
                    if (update) {
                        Pdu.update(status)
                            .then(() => {
                                q.next();
                            })
                        ;
                    } else {
                        q.next();
                    }
                } else {
                    q.next();
                }
            });
            q.once('done', () => {
                if (typeof done == 'function') {
                    status.imsi = origin;
                    status.address = msg.address;
                    if (hash) status.hash = hash;
                    done(status);
                }
            });
        });
    }

    findPdu(origin, hash, done) {
        this.PduReport.findAll({where: {imsi: origin}, order: [['time', 'DESC']]})
            .then((results) => {
                const q = new ntQueue(results, (report) => {
                    this.updateReport(origin, report, false, (status) => {
                        if (status.hash == hash) {
                            if (typeof done == 'function') {
                                done(status);
                            }
                        } else {
                            q.next();
                        }
                    });
                });
                q.once('done', () => {
                    if (typeof done == 'function') {
                        done({});
                    }
                });
            })
        ;
    }

    getPendingActivities() {
        return this.Activity.findAll({
            where: {
                status: 0,
                type: {[Sequelize.Op.in]: [this.ACTIVITY_RING, this.ACTIVITY_INBOX, this.ACTIVITY_CUSD]}
            },
            order: [['time', 'ASC']]
        });
    }

    getReports(since) {
        if (!since) {
            const dt = new Date();
            since = new Date(dt.getFullYear(), dt.getMonth(), dt.getDay(), 0, 0, 0, 0);
        } else if (!isNaN(since)) {
            since = new Date(parseInt(since))
        }
        return this.PduReport.findAll({
            where: {
                time: {[Sequelize.Op.gte]: since}
            }
        });
    }
}

module.exports = new AppStorage();