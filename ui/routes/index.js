const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const moment  = require('moment');
const util    = require('util');

function getActivity(req, res, next) {
  const result = {};
  const stor = req.app.term.Storage;
  const page = req.params.page || 1;
  const pageSize = 25;
  stor.Activity.count().then((count) => {
    result.count = count;
    result.items = [];
    var offset = (page - 1) * pageSize;
    stor.Activity.findAll({
      order: [['time', 'DESC']],
      offset: offset,
      limit: pageSize
    }).then((results) => {
      results.forEach((activity) => {
        offset++;
        result.items.push({
          nr: offset,
          hash: activity.hash,
          origin: activity.imsi,
          type: activity.type,
          address: activity.address,
          data: activity.data,
          status: activity.status,
          time: moment(activity.time).format('DD MMM YYYY HH:mm')
        });
      });
      // create pagination
      result.pages = res.pager(result.count, pageSize, page);
      // send content
      res.json(result);
    });
  });
}

function getLog(req, res, next) {
  const result = {};
  const term = req.app.term;
  if (req.params.term) {
    const gsm = term.Pool.get(req.params.term);
    if (gsm) {
      // send content
      result.time = Date.now();
      result.logs = fs.readFileSync(gsm.logfile).toString();
    }
  }
  res.json(result);
}

function getActivityLog(req, res, next) {
  const term = req.app.term;
  const result = {
    time: Date.now(),
    logs: fs.readFileSync(term.logfile).toString()
  }
  res.json(result);
}

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {
    title: 'Dashboard',
    sockaddress: `${req.protocol}://${req.get('host')}/ui`
  });
});

router.get('/about', function(req, res, next) {
  const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json')));
  res.json({
    title: packageInfo.description,
    version: packageInfo.version,
    author: packageInfo.author,
    license: packageInfo.license
  });
});

router.get('/activity', function(req, res, next) {
  getActivity(req, res, next);
});

router.get('/activity/:page', function(req, res, next) {
  getActivity(req, res, next);
});

router.get('/log/:term', function(req, res, next) {
  getLog(req, res, next);
});

router.get('/activity-log', function(req, res, next) {
  getActivityLog(req, res, next);
});

router.get('/client', function(req, res, next) {
  const result = [];
  const term = req.app.term;
  var nr = 0;
  term.clients.forEach((socket) => {
    const info = {
      nr: ++nr,
      id: socket.id,
      address: socket.handshake.address
    }
    result.push(info);
  });
  res.json({items: result});
});

router.post('/:term/at', function(req, res, next) {
  const result = {success: false};
  if (req.params.term && req.body.command) {
    const term = req.app.term;
    const terminal = term.get(req.params.term);
    if (terminal) {
      terminal.query(req.body.command)
        .then((res) => {
          result.success = true;
          if (res) {
            result.notice = util.format('Command return OK [%s]', JSON.stringify(res));
          } else {
            result.notice = 'Command return OK';
          }
          res.json(result);
        })
        .catch((err) => {
          if (err instanceof Error) {
            result.error = err.message;
          } else {
            result.error = err;
          }
          res.json(result);
        })
      ;
    } else {
      res.json(result);
    }
  } else {
    next();
  }
});

module.exports = router;
