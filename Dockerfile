FROM node:boron
LABEL majicbox='1.0.0'

# Create app directory
RUN mkdir -p /app
RUN mkdir -p /temp

COPY ./package.json /temp
RUN cd /temp && npm install
RUN cp -a /temp/node_modules /app/

EXPOSE 8000

WORKDIR /app
ADD . /app

CMD ./scripts/entrypoint.sh
