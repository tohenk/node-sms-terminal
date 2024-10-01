/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2018-2024 Toha <tohenk@yahoo.com>
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
 * Auto generated by MySQL Workbench Schema Exporter.
 * Version 4.1.0-dev (sequelize-v7 dev) on 2024-09-30 21:09:17.
 * Goto https://bit.ly/mwbexporter for more information.
 */

const { Sequelize, DataTypes } = require('@sequelize/core');

/**
 * A callback to transform model attributes.
 *
 * An example of attributes callback:
 *
 * ```
 * function attrCallback(attributes) {
 *     // do something with attributes
 *     return attributes;
 * }
 * ```
 *
 * @callback attrCallback
 * @param {object} attributes Model attributes
 * @returns {object}
 */

/**
 * A callback to transform model options.
 *
 * An example of options callback:
 *
 * ```
 * function optCallback(options) {
 *     // do something with options
 *     return options;
 * }
 * ```
 *
 * @callback optCallback
 * @param {object} options Model options
 * @returns {object}
 */

/**
 * Define Sequelize model `Pdu`.
 *
 * @param {Sequelize} sequelize Sequelize
 * @param {attrCallback|null} attrCallback A callback to transform model attributes
 * @param {optCallback|null} optCallback A callback to transform model options
 */
module.exports = (sequelize, attrCallback = null, optCallback = null) => {
    let attributes = {
        id: {
            type: DataTypes.INTEGER,
            columnName: 'id',
            primaryKey: true,
            autoIncrement: true
        },
        hash: {
            type: DataTypes.STRING(40),
            columnName: 'hash'
        },
        imsi: {
            type: DataTypes.STRING(20),
            columnName: 'imsi'
        },
        dir: {
            type: DataTypes.SMALLINT,
            columnName: 'dir'
        },
        address: {
            type: DataTypes.STRING(20),
            columnName: 'address'
        },
        pdu: {
            type: DataTypes.STRING(1024),
            columnName: 'pdu'
        },
        mr: {
            type: DataTypes.SMALLINT,
            columnName: 'mr'
        },
        code: {
            type: DataTypes.INTEGER,
            columnName: 'code'
        },
        sent: {
            type: DataTypes.DATE,
            columnName: 'sent'
        },
        received: {
            type: DataTypes.DATE,
            columnName: 'received'
        },
        time: {
            type: DataTypes.DATE,
            columnName: 'time'
        }
    }
    let options = {
        sequelize: sequelize,
        modelName: 'Pdu',
        tableName: 'pdu',
        indexes: [
            {
                name: 'hash',
                fields: ['hash'],
                unique: null
            },
            {
                name: 'imsi',
                fields: ['imsi'],
                unique: null
            },
            {
                name: 'pdu',
                fields: ['pdu'],
                unique: null
            }
        ],
        timestamps: false,
        underscored: false,
        syncOnAssociation: false
    }
    if (typeof attrCallback === 'function') {
        attributes = attrCallback(attributes);
    }
    if (typeof optCallback === 'function') {
        options = optCallback(options);
    }

    const Pdu = sequelize.define('Pdu', attributes, options);
    return Pdu;
}