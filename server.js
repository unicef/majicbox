// Main entrypoint for the majicbox server: defines the API endpoints and starts
// the Express server.

var apicache = require('apicache').options({debug: true}).middleware;
var bodyParser = require('body-parser');
var compression = require('compression');
var express = require('express');
var mongoose = require('mongoose');
var morgan = require('morgan');

var config = require('./config');
var util = require('./util');

var app = express();

app.use(compression());  // gzip.
app.use(morgan('dev'));  // request logging.

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

/* eslint new-cap: [2, {"capIsNewExceptions": ["express.Router"]}] */
var router = express.Router(); // get an instance of the express Router

/** Wrapper for get_region_populations.
 * @param{object} req - Express request object.
 * @param{object} res - Express ressponse object.
 * @param{object} next - Express next callback.
 * @return{Promise} Fulfilled when done.
 */
function handle_region_populations(req, res, next) {
  return util.get_region_populations(req.params.country_code, req.params.time1,
                                     req.params.time2)
    .then(res.json.bind(res))
    .catch(function(err) {
      console.error('error handling /region_populations/:', err);
      return next(err);
    });
}

// TODO(jetpack): It's redundant to have a cache for each of these (especially
// the time-based endpoints). We should instead wrap util.get_region_populations
// directly.
router.route('/region_populations/:country_code')
  .get(apicache('1 day'), handle_region_populations);
router.route('/region_populations/:country_code/:time1')
  .get(apicache('1 day'), handle_region_populations);
router.route('/region_populations/:country_code/:time1/:time2')
  .get(apicache('1 day'), handle_region_populations);

// All of our routes will be prefixed with '/api'.
app.use('/api', router);

mongoose.connect(config.database);
app.listen(config.port);
console.log('Connecting to DB', config.database);
console.log('Magic happens on', config.port);
