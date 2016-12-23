import range from 'lodash/range'
import Activity from '../../models/activity';
import moment from 'moment'

function extractAdminInfo(admin_id) {
	const tokens = admin_id.split('_')
	const country_code = tokens[0]
	const admin_0 = !isNaN(tokens[1]) ? Number(tokens[1]) : null
	const admin_1 = !isNaN(tokens[2]) ? Number(tokens[2]) : null
	const admin_2 = !isNaN(tokens[3]) ? Number(tokens[3]) : null

	let admin_level = 'admin_0'
	if(admin_2 !== null) {
		admin_level = 'admin_2'
	} else if (admin_1 !== null) {
		admin_level = 'admin_1'
	}

	return {
		country_code,
		admin_0,
		admin_1,
		admin_2,
		admin_level
	}
}

export default function PostTweet(req, res) {
	const tweet = req.body
	const { country_code, admin_0, admin_level } = extractAdminInfo(tweet.admin_id)

	const date = moment(tweet.local_time, 'x');
	const criteria = {
		country_code,
		admin_code: tweet.admin_id,
		date: date
	};

	Activity.findOne(criteria, function(err, day = null) {
		if (day === null) {
			const counts = range(23).map(() => 0)
			counts[date.hours()] = 1
			Activity({
				country_code,
				date: date,
				frequency: 'daily',
				key_ids: [tweet.id],
				counts,
				admin_code: tweet.admin_id,
				data_source: 'twitter',
				crawler: tweet.crawler || 'N/A',
				type: 'tweets'
			}).save(handler);

			return;
		}

		// if (day.tweets_ids.indexOf(tweet.tweet_id) === -1 ) {
		// 	res.json({
		// 		error: `tweet ${tweet.tweet_id} already counted`
		// 	})
		//
		// 	return;
		// }
		if (day.key_ids.indexOf(tweet.id) !== -1) {
			handler({ msg: `Tweet ${tweet.id} has been counted`})
			return
		}
		day.counts = day.counts.map((count, idx) => idx === date.hours() ? count + 1 : count)
		day.counts = [...day.counts, tweet.id]
		day.save(handler)
	})

	function handler(error, doc = null) {
		if(error) {
			console.log('ERRROR---', error)
			res.status(404).json({error})
			return
		}
		console.log(`Tweet ${tweet.id} has been saved`)
		res.json({doc})
	}

}
