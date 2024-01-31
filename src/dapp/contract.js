import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";

export default class Contract {
  constructor(network, callback) {
    let config = Config[network];
    // this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
    this.web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace("http", "ws")));

    this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
    this.initialize(callback);
    this.owner = null;
    this.airlines = [];
    this.passengers = [];
    this.airlineData = [];
    this.airlineFlights = {};
  }

  initialize(callback) {
    this.web3.eth.getAccounts((error, accts) => {
      this.owner = accts[0];

      /*************************************************************************************************************/
      /* Manually build the Airlines Addresses and Flights Lists. This is to be replaced with a UI implementation. */
      /*************************************************************************************************************/

      // Accounts from index 1 to 20 are reserved for the oracles.
      // For the airlines, we'll use addresses from index 21 to 25:
      //    0x90FFD070a8333ACB4Ac1b8EBa59a77f9f1001819
      //    0x036945CD50df76077cb2D6CF5293B32252BCe247
      //    0x23f0227FB09D50477331D2BB8519A38a52B9dFAF
      //    0x799759c45265B96cac16b88A7084C068d38aFce9
      //    0xA6BFE07B18Df9E42F0086D2FCe9334B701868314
      let counter = 21;

      console.log("--- Airline Addresses ---");

      // Assign the addresses

      while (this.airlines.length < 5) {
        console.log(accts[counter]);
        this.airlines.push(accts[counter++]);
      }

      let timestamp = Math.floor(Date.now() / 1000); // To be incremented to garantee that the timestamp is unique

      // Hashmap to be populated with all airlines and flights to be used in the UI and contract calls:
      // Key: First part corresponds to the Index of the airline address in the `airlines` array and the second part is the flight name
      // Value: Is a list containing unique data with fields: a duplicate of the key, airline address and name, flight name, and timestamp

      this.airlineFlights["0-AA2655"] = {
        uniqueCode: "0-AA2655",
        airlineAddress: this.airlines[0],
        airlineName: "Atlas Airlines",
        flight: "AA2655",
        timestamp: timestamp + 0,
      };
      this.airlineData.push(this.airlineFlights["0-AA2655"]);

      this.airlineFlights["1-FW1122"] = {
        uniqueCode: "1-FW1122",
        airlineAddress: this.airlines[1],
        airlineName: "Freedom Wings",
        flight: "FW1122",
        timestamp: timestamp + 1,
      };
      this.airlineData.push(this.airlineFlights["1-FW1122"]);

      this.airlineFlights["2-BA3344"] = {
        uniqueCode: "2-BA3344",
        airlineAddress: this.airlines[2],
        airlineName: "Borealis Air",
        flight: "BA3344",
        timestamp: timestamp + 2,
      };
      this.airlineData.push(this.airlineFlights["2-BA3344"]);

      this.airlineFlights["3-BA3344"] = {
        uniqueCode: "3-BA3344",
        airlineAddress: this.airlines[3],
        airlineName: "Beacon Airlines",
        flight: "BA3344",
        timestamp: timestamp + 3,
      };
      this.airlineData.push(this.airlineFlights["3-BA3344"]);

      this.airlineFlights["1-FW6611"] = {
        uniqueCode: "1-FW6611",
        airlineAddress: this.airlines[1],
        airlineName: "Freedom Wings",
        flight: "FW6611",
        timestamp: timestamp + 4,
      };
      this.airlineData.push(this.airlineFlights["1-FW6611"]);

      this.airlineFlights["4-HA6611"] = {
        uniqueCode: "4-HA6611",
        airlineAddress: this.airlines[4],
        airlineName: "Horizon Air",
        flight: "HA6611",
        timestamp: timestamp + 5,
      };
      this.airlineData.push(this.airlineFlights["4-HA6611"]);

      /************************************************************************************************************/
      /*           Manually Register and Fund the Airlines. This is to be replaced with a UI implementation.      */
      /************************************************************************************************************/

      let airlineRegistrationFee = this.web3.utils.toWei("10", "Ether");

      for (let i = 0; i < this.airlines.length; i++) {
        this.flightSuretyApp.methods.registerAirline(this.airlines[i]);
        this.flightSuretyApp.methods.fund().send({ from: this.airlines[i], value: airlineRegistrationFee, gas: 9999999 });
      }

      /************************************************************************************************************/
      /*               Manually Register the Flights. This is to be replaced with a UI implementation.            */
      /************************************************************************************************************/

      this.airlineData.forEach((airlineFlightInfo) => {
        this.flightSuretyApp.methods
          .registerFlight(airlineFlightInfo.airlineAddress, airlineFlightInfo.flight, airlineFlightInfo.timestamp)
          .send({ from: airlineFlightInfo.airlineAddress, gas: 300000 });
      });

      /************************************************************************************************************/
      /*             Manually build the Passengers List. This is to be replaced with a UI implementation.         */
      /************************************************************************************************************/

      // For the passengers, we'll use addresses from index 26 to 30:
      //    0x39Ae04B556bbdD73123Bab2d091DCD068144361F
      //    0x068729ec4f46330d9Af83f2f5AF1B155d957BD42
      //    0x9EE19563Df46208d4C1a11c9171216012E9ba2D0
      //    0x04ab41d3d5147c5d2BdC3BcFC5e62539fd7e428B
      //    0xeF264a86495fF640481D7AC16200A623c92D1E37

      console.log("--- Passenger Addresses ---");
      while (this.passengers.length < 5) {
        console.log(accts[counter]);
        this.passengers.push(accts[counter++]);
      }

      callback();
    });
  }

  isOperational(callback) {
    let self = this;
    self.flightSuretyApp.methods.isOperational().call({ from: self.owner }, callback);
  }

  async fundAirline(callback) {
    let self = this;
    let airlineRegistrationFee = await self.flightSuretyApp.methods.AIRLINE_REGISTRATION_FEE.call().call();

    self.flightSuretyApp.methods.fund().send({ from: self.airlines[0], value: airlineRegistrationFee, gas: 9999999 }, (error, result) => {
      callback;
    });
  }

  buy(flightCode, passenger, amount, callback) {
    let self = this;

    let payload = {
      airline: self.airlineFlights[flightCode].airlineAddress,
      flight: self.airlineFlights[flightCode].flight,
      timestamp: self.airlineFlights[flightCode].timestamp,
    };
    self.flightSuretyApp.methods
      .buy(payload.flight, payload.airline, payload.timestamp)
      .send({ from: passenger, value: this.web3.utils.toWei(amount, "Ether"), gas: 300000 }, (error, result) => {
        callback(error, payload);
      });
  }

  withdraw(passenger, callback) {
    let self = this;
    let payload = {
      payee: passenger,
    };

    self.flightSuretyApp.methods.withdraw(payload.payee).send({ from: self.owner, gas: 300000 }, (error, result) => {
      callback(error, payload);
    });
  }

  fetchFlightStatus(flightCode, callback) {
    let self = this;
    let payload = {
      airline: self.airlineFlights[flightCode].airlineAddress,
      flight: self.airlineFlights[flightCode].flight,
      timestamp: self.airlineFlights[flightCode].timestamp,
    };
    self.flightSuretyApp.methods.fetchFlightStatus(payload.airline, payload.flight, payload.timestamp).send({ from: self.owner }, (error, result) => {
      callback(error, payload);
    });
  }
}
