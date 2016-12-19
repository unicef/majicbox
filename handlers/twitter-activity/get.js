import ActivityModel from '../../app/models/twitter-activity'
import moment from 'moment'

function normalize(rows = [], days) {
	const availableDays = rows.map()
}

function getDaysArray(start_date, end_date) {
return []
}

export default function GetTweets(req, res) {
	// start_END&include_tweet_ids&country_code
	const {
		country_code,
	 	start_date,
		end_date,
		include_tweets= true,
		page= 1,
		limit= 100
	} = req.query
	ActivityModel.find({
		country_code,
		local_day: {
			$gte: start_date,
			$lte: end_date
		}
	})
	.then(rows => normalize(rows, start_date, end_date))
	.then(res.json.bind(res))
	.catch(error => res.json({error}))
}
