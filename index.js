const PORT = process.env.PORT || 8002;
const express = require("express");
const morgan = require("morgan");
const axios = require("axios");
const dotenv = require('dotenv');

dotenv.config();
const url = process.env.URL;
const apiKey = process.env.API_KEY;

const app = express();
let cacheCoinWithCode = new Map();
let cacheCoinWithName = new Map();
let coinList = {};
const formatter = new Intl.NumberFormat("de-DE");
let firstTimestamp, secondTimeStamp;

app.use(morgan("tiny"));

const server = app.listen(PORT, () => {
  console.log(`Server running on PORT: ${PORT}`);
});

app.get("/coins", (req, res) => {
  return res.json(coinList);
});

app.get("/coin/code/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  if (cacheCoinWithCode.get(code) === undefined) {
    res.status(500);
    return res.json({ error: true, message: "Invalid coin code" });
  }
  return res.json(cacheCoinWithCode.get(code));
});

app.get("/coin/name/:name", (req, res) => {
  let name = req.params.name.toUpperCase();
  if (cacheCoinWithName.get(name) === undefined) {
    res.status(500);
    return res.json({ error: true, message: "Invalid coin name" });
  }
  return res.json(cacheCoinWithName.get(name));
});

const getCoinList = () => {
  const data = {
    currency: "USD",
    sort: "rank",
    order: "ascending",
    offset: 0,
    limit: 15000,
    meta: true,
  };
  firstTimestamp = new Date().getTime();
  console.log("Sending request for live coin..");
  axios
    .post(url, data, {
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
    })
    .then((response) => {
      secondTimeStamp = new Date().getTime();
      console.log("Response time: ", secondTimeStamp - firstTimestamp);
      response.data.forEach((element) => {
        const volume = formatter.format(element.volume);
        const lastIndexOfVolumeDot = volume.lastIndexOf(".");
        const cap = formatter.format(element.cap);
        const lastIndexOfCapDot = cap.lastIndexOf(".");
        const coinBody = {
          name: element.name,
          code: element.code,
          rate: {
            base: "USD",
            amount: convertToCurrency(element.rate),
            totalVolume: volume.includes(".")
              ? getStringWithComma(volume, lastIndexOfVolumeDot)
              : volume,
            capInMarket: cap.includes(".")
              ? getStringWithComma(cap, lastIndexOfCapDot)
              : cap,
            maxValueEver: convertToCurrency(element.allTimeHighUSD),
          },
        };
        cacheCoinWithCode.set(element.code, coinBody);
        cacheCoinWithName.set(element.name.toUpperCase(), coinBody);
        coinList[element.code.trim()] = element.name.trim();
      });
      console.log(
        "Total process time for ETL: ",
        new Date().getTime() - secondTimeStamp
      );
    })
    .catch((error) => {
      console.log("Error occurred: ", error);
    });
};

const convertToCurrency = (t) => {
  t = t + "";
  if (!t.includes(".")) return t;
  const arr = t.split(".");
  const decimal = new Intl.NumberFormat("de-DE").format(parseInt(arr[0]));
  return decimal.toString() + "," + arr[1].substring(0, 8);
};

const getStringWithComma = (s, index) => {
  return s.substring(0, index) + "," + s.substring(index + 1);
};

const init = () => {
  if (url === undefined || apiKey === undefined) {
    console.log("URL or APIKEY could not be null");
    server.close();
    return;
  }
  getCoinList();
  setTimeout(init, 90000);
};

init();
