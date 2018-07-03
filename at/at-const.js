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
 * AT constants.
 */

const ntAtConst     = module.exports = exports;

ntAtConst.SMS_MODE_PDU                        = 0;
ntAtConst.SMS_MODE_TEXT                       = 1;

ntAtConst.SMS_STAT_RECV_UNREAD                = 0;
ntAtConst.SMS_STAT_RECV_READ                  = 1;
ntAtConst.SMS_STAT_STORED_UNSENT              = 2;
ntAtConst.SMS_STAT_STORED_SENT                = 3;
ntAtConst.SMS_STAT_ALL                        = 4;

ntAtConst.USSD_NO_ACTION                      = 0;
ntAtConst.USSD_ACTION_REQUIRED                = 1;
ntAtConst.USSD_TERMINATED                     = 2;
ntAtConst.USSD_LOCAL_RESPOND                  = 3;
ntAtConst.USSD_NOT_SUPPORTED                  = 4;
ntAtConst.USSD_TIMEOUT                        = 5;

ntAtConst.USSD_ENC_7BIT                       = 15;
ntAtConst.USSD_ENC_UCS2                       = 72;
