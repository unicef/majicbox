// Main entrypoint for the majicbox server.

var bodyParser = require('body-parser');
var express = require('express');

var app = express();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// ROUTES FOR OUR API
// =============================================================================
/* eslint new-cap: [2, {"capIsNewExceptions": ["express.Router"]}] */
var router = express.Router(); // get an instance of the express Router

// test route to make sure everything is working
router.get('/', function(req, res) {
  res.json({message: 'hooray! welcome to our api!'});
});

// All of our routes will be prefixed with '/api'.
app.use('/api', router);

var port = process.env.PORT || 8000;
app.listen(port);
console.log('Magic happens on', port);
