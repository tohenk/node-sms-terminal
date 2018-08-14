const express = require('express');
const router  = express.Router();

router.get('/login', function(req, res, next) {
  var redir;
  if (req.params.r) {
    redir = req.params.r;
  } else if (req.query.r) {
    redir = req.query.r;
  }
  res.app.slots.mainmenu.enabled = false;
  res.render('security/login', {redirect: redir ? redir : '/'});
});

router.post('/login', function(req, res, next) {
  const result = {
    success: false
  }
  if (req.user.authenticate(req.body.username, req.body.password)) {
    req.user.login();
    result.success = true;
    result.url = req.body.continue ? req.body.continue : '/';
  } else {
    result.error = 'Invalid username and/or password';
  }
  res.json(result);
});

router.get('/logout', function(req, res, next) {
  if (req.user) {
    req.user.logout();
  }
  res.redirect('/');
});

module.exports = router;
