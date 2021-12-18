FROM node:latest

ENV TOP_DIR /TVCArouter

RUN mkdir ${TOP_DIR}

COPY tvca_router.js ${TOP_DIR}
COPY package.json ${TOP_DIR}
COPY package-lock.json ${TOP_DIR}

WORKDIR ${TOP_DIR}
RUN npm install

CMD ["/usr/local/bin/node","tvca_router.js"]

