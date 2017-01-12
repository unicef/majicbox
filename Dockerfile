FROM node:7.3.0
LABEL majicbox='1.0.0'
MAINTAINER Qusai Jouda

# Create app directory
RUN mkdir -p /app
RUN mkdir -p /temp

COPY ./package.json /temp
RUN cd /temp && npm install
RUN cp -a /temp/node_modules /app/

RUN npm install nodemon -g

EXPOSE 8000

WORKDIR /app
ADD . /app

CMD ["node", "server.js"]
