import express from 'express'
import apicache from 'apicache'
import util from '../../util'

const cacheIt = apicache.options({ debug: false }).middleware
const router = express.Router()

router.route('/egress_mobility/:admin_code/:start_time?/:end_time?')
  .get(cacheIt('1 day'), function(req, res, next) {
    var p = req.params;
    util.get_egress_mobility(p.admin_code, date_param(p.start_time),
                             date_param(p.end_time))
      .then(res.json.bind(res))
      .catch(next);
  });

router.route('/mobility_populations/:country_code/:start_time?/:end_time?')
  .get(cacheIt('1 day'), function(req, res, next) {
    var p = req.params;
    util.get_mobility_populations(p.country_code, date_param(p.start_time),
                                  date_param(p.end_time))
      .then(res.json.bind(res))
      .catch(next);
  });

export default router
