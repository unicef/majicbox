export function date_param(date_string) {
  var unix_secs = Date.parse(date_string);
  return unix_secs ? new Date(unix_secs) : null;
}
