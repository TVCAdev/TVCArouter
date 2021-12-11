"use strict";

const fs = require("fs")

const request = require("request");
const io_client = require("socket.io-client");

// connect to heroku using websocket
let socket_client = io_client(process.env.LINEBOT_URL, {
    query: {
        token: process.env.WEBSOCKET_TOKEN,
    },
});

// websocket message recieve
socket_client.on("GET_LIVINGPIC", () => {
    console.log("GET_LIVINGPIC");

    let options = {
        url: process.env.WEBAPI_POST_MSG_URL,
        json: true,
    };

    request.get(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            socket_client.conn.emit("GET_LIVINGPIC", body);

            // for debug code
            //let decode_file = Buffer.from(body.data, 'base64');
            //fs.writeFileSync("aaa.jpg", decode_file);
        } else if (typeof response === "undefined") {
            console.log('error: response is undefined.');
        } else if (typeof response.statusCode === "undefined") {
            console.log('error: response.statusCode is undefined.');
        } else {
            console.log('error: ' + response.statusCode);
        }
    });
});
