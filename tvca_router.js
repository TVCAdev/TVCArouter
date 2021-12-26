"use strict";

const fs = require("fs")

const axios = require("axios");
const io_client = require("socket.io-client");

// connect to heroku using websocket
const socket_client = io_client(process.env.LINEBOT_URL, {
    query: {
        token: process.env.WEBSOCKET_TOKEN,
    },
});

// websocket message receive
socket_client.on("GET_LIVINGPIC", () => {
    console.log("GET_LIVINGPIC was accept...");

    axios({
        method: 'get',
        url: process.env.WEBAPI_POST_MSG_URL + "GET_LIVINGPIC",
    })
        .then(function (response) {
            // case of getting camera data successfully
            if (typeof response !== "undefined" && response.status == 200) {
                socket_client.emit("GET_LIVINGPIC", response.data);

                // for debug code
                //let decode_file = Buffer.from(response.data.imgdata, 'base64');
                //fs.writeFileSync("aaa.jpg", decode_file);
            } else if (typeof response === "undefined") {
                console.log('GET_LIVINGPIC: error - response is undefined.');
            } else if (typeof response.status === "undefined") {
                console.log('GET_LIVINGPIC: error - response.status is undefined.');
            } else {
                console.log('GET_LIVINGPIC: error - status is ' + response.status);
            }
        })
        .catch(function (error) {
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                console.log(error.response.data);
                console.log(error.response.status);
                console.log(error.response.headers);
            } else if (error.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                console.log(error.request);
            } else {
                // Something happened in setting up the request that triggered an Error
                console.log('Error', error.message);
            }
            console.log(error.config);
        });
});
