#!/bin/bash
#
# TODO: Make setup a separate task

cp -r data-sample data
node lib/import/admin.js -c br --verbose true
node lib/import/fake_weather.js -c br -n 30
node lib/import/mobility.js -c 'br'

node server.js
