"use strict";

const fs = require("fs")

const axios = require("axios");
const io_client = require("socket.io-client");

// connect to heroku using websocket
const heroku_socket_client = io_client(process.env.LINEBOT_URL, {
    query: {
        token: process.env.WEBSOCKET_TOKEN,
    },
});

// get target cec control information
let cec_control_datas = JSON.parse(process.env.CEC_CONTROL_DATAS)
// set default data
cec_control_datas.forEach(elem => {
    elem.status = 'unknown';
    elem.ban = 'unknown';
});
console.log(cec_control_datas);

// timer ID for getting TV status
let timeoutID;
const INTERVAL = 15 * 1000;

// function for async WEBAPI
function async_webapi(action, target_url, func_name) {
    console.log('target_url:' + target_url + ' action:' + action + ' was called.');

    return axios({
        method: action,
        url: target_url,
    })
        .then(function (response) {
            // case of getting camera data successfully
            if (typeof response !== undefined && response.status == 200) {
                console.log(func_name + ': axios call was succeed.');
                // set response.data
                return response;
            } else if (typeof response === undefined) {
                throw new Error(func_name + ': error - response is undefined.');
            } else if (typeof response.status === undefined) {
                throw new Error(func_name + ': error - response.status is undefined.');
            } else {
                throw new Error(func_name + ': error - status is ' + response.status);
            }
        })
        .catch(function (error) {
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                console.log(func_name + ': axios call was failed. error.response was below:');
                console.log(error.response.data);
                console.log(error.response.status);
                console.log(error.response.headers);
            } else if (error.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                console.log(func_name + ': axios call was failed. error.request was below:');
                console.log(error.request);
            } else {
                // Something happened in setting up the request that triggered an Error
                console.log(func_name + ': axios call was failed. error.message was below:');
                console.log('Error', error.message);
            }
            throw new Error(func_name + ': axios call was failed.' + error.config);
        });
}

// websocket message GET_LIVINGPIC receive
heroku_socket_client.on("GET_LIVINGPIC", () => {
    console.log("GET_LIVINGPIC was accept...");

    // call webapi for getting living picture
    async_webapi('get', process.env.WEBAPI_LIVPIC_MSG_URL + "GET_LIVINGPIC", "GET_LIVINGPIC")
        // success
        .then(response => {
            console.log("GET LIVING PICTURE WAS SUCCEED.");

            // send living picture to heroku
            heroku_socket_client.emit("GET_LIVINGPIC", response.data);
        })
        // error
        .catch(data => {
            console.log(data);
        })
});

// websocket message GET_TV_STATUS receive
heroku_socket_client.on("GET_TV_STATUS", () => {
    console.log("GET_TV_STATUS was accept...");

    heroku_socket_client.emit("GET_TV_STATUS", cec_control_datas);
});

// websocket message UPDATE_TVBAN receive
heroku_socket_client.on("UPDATE_TVBAN", param => {
    console.log("UPDATE_TVBAN was accept...");

    // call webapi for set TV ban
    cec_control_datas.forEach(elem => {
        if (param.name == elem.name) {
            heroku_socket_client.emit("GET_TVBAN", { 'name': param.name });
        }
    });
});

// websocket message GET_TVBAN's reply receive
heroku_socket_client.on("GET_TVBAN", param => {
    console.log("GET_TVBAN's reply was accept...");
    console.log(param);

    // call webapi for set TV ban
    cec_control_datas.forEach(elem => {
        if (param.name == elem.name) {
            elem.ban = param.ban;
        }
    });
});

// function for getting TV status periodically
function get_tv_status() {
    console.log("start get_tv_status...");

    // create empty array
    let cec_promise = Array(cec_control_datas.length);

    // call webapi for getting all TV status
    cec_control_datas.forEach((elem, index) => {
        cec_promise[index] = async_webapi('get', 'http://' + elem.host + ':' + elem.port + '/GetTVPowerStatus', elem.name)
    });

    // wait for getting all TV status
    Promise.allSettled(cec_promise)
        // finish
        .then(responses => {
            let changeflag = [0, 0];
            responses.forEach((res, index) => {
                console.log(res);

                // if ban is unknown, get TV ban from heroku.
                if (cec_control_datas[index].ban == 'unknown') {
                    heroku_socket_client.emit("GET_TVBAN", { 'name': cec_control_datas[index].name });
                    console.log('GET_TVBAN was emitted for ban setting was unknown.');
                }

                if (res.status == 'fulfilled' && typeof res.value.data !== undefined && typeof res.value.data.status !== undefined) {

                    if (cec_control_datas[index].status != res.value.data.status) {
                        // set new status(standby or on)
                        cec_control_datas[index].status = res.value.data.status
                        // set changeflag
                        changeflag[index] = 1;
                    }

                    // check TV ban mode
                    if ((cec_control_datas[index].ban == '1') && (cec_control_datas[index].status == 'on')) {
                        // turn TV off
                        async_webapi('put', 'http://' + cec_control_datas[index].host + ':' + cec_control_datas[index].port + '/SetTVPower/off', cec_control_datas[index].name)
                    }
                }
                else {
                    if (cec_control_datas[index].status != 'offline') {
                        // set new status(offline)
                        cec_control_datas[index].status = 'offline'
                        // set changeflag
                        changeflag[index] = 1;

                        // notify offline information
                        heroku_socket_client.emit("NOTIFY_TV_OFFLINE", { name: cec_control_datas[index].name, status: cec_control_datas[index].status });
                    }
                }
            })
            console.log(cec_control_datas);

            // whether occur change or not.
            changeflag.forEach((flag, index) => {
                // check changeflag for detecting chang.
                if (flag == 1) {
                    // send datas for logging
                    heroku_socket_client.emit("LOG_TV_STATUS", { name: cec_control_datas[index].name, status: cec_control_datas[index].status });
                }
            })

            // call get_tv_status function intervally
            timeoutID = setTimeout(get_tv_status, INTERVAL);
        })
}

// start timer for getting TV status
timeoutID = setTimeout(get_tv_status, INTERVAL);
