.PHONY: lint
lint:
	./node_modules/eslint/bin/eslint.js .

# Runs unit tests in a Docker container. Probably not necessary for typical
# usage ... Docker is fast but maybe not as interactive as local. Maybe good
# to run on Jenkins or another deploy system, if we ever start using such.
.PHONY: utest-in-docker
utest-in-docker:
	docker-compose build unit-tests && docker-compose run --rm unit-tests
