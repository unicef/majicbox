import range from 'lodash/range'
var ActivityModel = require('../../app/models/twitter-activity');
var moment = require('moment');

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
		admin_id: tweet.admin_id,
		local_day: date.format('DD/MM/YY')
	};

	ActivityModel.findOne(criteria, function(err, day = null) {
		if (day === null) {
			const hours = range(23).map(() => 0)
			hours[date.hours()] = 1
			ActivityModel({
				country_code,
				local_day: date.format('DD/MM/YY'),
				tweets_ids: [tweet.tweet_id],
				hours,
				admin_id: tweet.admin_id
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
		day.hours = day.hours.map((count, idx) => idx === date.hours() ? count + 1 : count)
		day.tweets_ids = [...day.tweets_ids, tweet.tweet_id]
		day.save(handler)
	})

	function handler(error, doc = null) {
		if(error) {
			console.log('ERRROR---', error)
			res.status(404).json({error})
			return
		}
		console.log('SAVED ONE')
		res.json({doc})
	}

}
