import express from 'express'
import apicache from 'apicache'
import util from '../../util'

const cacheIt = apicache.options({ debug: false }).middleware
const router = express.Router()

router
  .route('/country_weather/:country_code/:time?')
  .get(cacheIt('1 day'), function(req, res, next) {
    var p = req.params;
    util.get_country_weather(p.country_code, date_param(p.time))
      .then(res.json.bind(res))
      .catch(next);
  });

router
  .route('/admin_weather/:admin_code/:start_time?/:end_time?')
  .get(cacheIt('1 day'), function(req, res, next) {
    var p = req.params;
    util.get_admin_weather(p.admin_code, date_param(p.start_time),
                           date_param(p.end_time))
      .then(res.json.bind(res))
      .catch(next);
  });

export default router
