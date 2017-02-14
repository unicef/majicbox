
/**
 * Wrapper for _.setWith that is like _.set, except it works with number
 * strings. _.set with a number string in the path will create an array.
 * Example: _.set({}, ['br', '1'], 'value') -> {"br": [null,"value"]}
 * Versus: my_set({}, ['br', '1'], 'value') -> {"br": {"1": "value"}}
 *
 * @param{string} date_string - date to modify.
 * @return{Object} Returns date.
 **/
exports.date_param = function(date_string) {
  var unix_secs = Date.parse(date_string);
  return unix_secs ? new Date(unix_secs) : null;
};
