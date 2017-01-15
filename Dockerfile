FROM node:7.3.0
MAINTAINER UnicefInnovation Office

ENV HOME /code

WORKDIR $HOME

ADD package.json $HOME/package.json

RUN npm install
RUN npm install -g nodemon

ADD . $HOME

EXPOSE 8000

CMD ["npm", "start"]
