import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";

let config = Config["localhost"];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace("http", "ws")));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

let oraclePool = 20;
let registeredOracles = [];
let STATUS_CODES = [0, 10, 20, 30, 40, 50];

flightSuretyApp.events.OracleRequest(
  {
    fromBlock: 0,
  },
  function (error, event) {
    if (error) console.log(error);

    let index = event.returnValues.index;
    let airline = event.returnValues.airline;
    let flight = event.returnValues.flight;
    let timestamp = event.returnValues.timestamp;
    let statusCode = STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)];

    for (let i = 0; i < registeredOracles.length; i++) {
      if (registeredOracles[i].index.includes(index)) {
        flightSuretyApp.methods
          .submitOracleResponse(index, airline, flight, timestamp, statusCode)
          .send({ from: registeredOracles[i].address, gas: 9999999 }, (error, result) => {
            console.log("FROM " + JSON.stringify(registeredOracles[i]) + "STATUS CODE: " + statusCode);
          });
      }
    }
    console.log(event);
  }
);

const registerOracles = async () => {
  let accounts = await web3.eth.getAccounts();
  let oracleRegistrationFee = await flightSuretyApp.methods.REGISTRATION_FEE().call();

  for (let i = 0; i < oraclePool; i++) {
    flightSuretyApp.methods.registerOracle().send({ from: accounts[i], value: oracleRegistrationFee, gas: 9999999 }, (error, result) => {
      flightSuretyApp.methods.getMyIndexes().call({ from: accounts[i] }, (error, result) => {
        let oracle = { address: accounts[i], index: result };
        registeredOracles.push(oracle);
        console.log("Oracle Registered: " + JSON.stringify(oracle));
      });
    });
  }
};

(async () => {
  await registerOracles();
})();

const app = express();
app.get("/api", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!",
  });
});

export default app;
