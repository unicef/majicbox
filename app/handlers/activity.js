import express from 'express';
import apicache from 'apicache';
import {travel_from_country_activity} from '../../lib/travel_activity'

const cacheIt = apicache.options({debug: false}).middleware;
const router = express.Router();

router.route('/travel_from_country_activity/:start_date/:end_date/:country_iso?')
  .get(cacheIt('1 day'), function(req, res, next) {
    var p = req.params;
    travel_from_country_activity(
      p.start_date,
      p.end_date,
      p.country_iso
    ).then(res.json.bind(res)).catch(next);
  });

export default router;