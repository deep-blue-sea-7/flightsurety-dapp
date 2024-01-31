import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";
import Web3 from "web3";

(async () => {
  let result = null;
  let web3Provider = null;
  let metamaskAccountID = "0x0000000000000000000000000000000000000000";

  let contract = new Contract("localhost", () => {
    /// Find or Inject Web3 Provider
    /// Modern dapp browsers...
    if (window.ethereum) {
      web3Provider = window.ethereum;
      try {
        // Request account access
        window.ethereum.enable();
      } catch (error) {
        // User denied account access...
        console.error("User denied account access");
      }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
      web3Provider = window.web3.currentProvider;
    }
    // If no injected web3 instance is detected, fall back to Ganache
    else {
      web3Provider = new Web3.providers.HttpProvider("http://localhost:8545");
    }
    web3 = new Web3(web3Provider);

    // Retrieve accounts
    web3.eth.getAccounts(function (err, res) {
      if (err) {
        console.log("Error:", err);
        return;
      }
      console.log("getMetaskID:", res);
      metamaskAccountID = res[0];
      web3.eth.defaultAccount = res[0];
    });

    // Read transaction
    contract.isOperational((error, result) => {
      console.log(error, result);
      display("Operational Status", "Check if contract is operational", [{ label: "Operational Status", error: error, value: result }]);

      let airlineData = contract.airlineData;

      // Flights List for Passengers
      var flightsSelection = DOM.elid("flights");
      // Flights List for Oracles
      var oraclesForFlightsSelection = DOM.elid("oracles-for-flights");

      for (var i = 0; i < airlineData.length; i++) {
        // Populate the Flights List for Passengers
        flightsSelection.options[flightsSelection.options.length] = new Option(
          airlineData[i].airlineName + " " + airlineData[i].flight,
          airlineData[i].uniqueCode
        );
        // Populate the Flights List for Passengers
        oraclesForFlightsSelection.options[oraclesForFlightsSelection.options.length] = new Option(
          airlineData[i].airlineName + " " + airlineData[i].flight,
          airlineData[i].uniqueCode
        );
      }
    });

    // User-submitted transaction: Get Flight Status
    DOM.elid("submit-oracle").addEventListener("click", () => {
      let flightCode = DOM.elid("oracles-for-flights").value;
      if (flightCode != "none") {
        // Write transaction
        contract.fetchFlightStatus(flightCode, (error, result) => {
          display("Oracles", "Trigger oracles", [{ label: "Fetch Flight Status", error: error, value: result.flight }]);
        });
      }
    });

    // User-submitted transaction: Pay Insurance
    DOM.elid("submit-buy-insurance").addEventListener("click", () => {
      let flightCode = DOM.elid("flights").value;
      let insuranceAmount = DOM.elid("insurance-amount").value;

      if (flightCode != "none") {
        // Write transaction
        contract.buy(flightCode, metamaskAccountID, insuranceAmount, (error, result) => {
          console.log(result);
          display("Passengers", "Buy Insurance", [
            { label: "Purchasing insurance for flight", error: error, value: result.flight + " with airline address: " + result.airline },
          ]);
        });
      }
    });

    // User-submitted transaction: Claim Insurance
    DOM.elid("claim-insurance-funds").addEventListener("click", () => {
      // Write transaction
      contract.withdraw(metamaskAccountID, (error, result) => {
        console.log(result);
        display("Passengers", "Claim Payment", [{ label: "Withdrawing Payout into Account:", error: error, value: result.payee }]);
      });
    });

    // Handle event FlightStatusInfo
    contract.flightSuretyApp.events.FlightStatusInfo({}, (error, event) => {
      let flightNumber = event.returnValues.flight;
      let timestamp = event.returnValues.timestamp;
      let status = event.returnValues.status;

      console.log(`Received current status for flight ${flightNumber} Time: ${timestamp} Status Code: ${status}`);
      if (status == 20) {
        console.log(`Flight ${flightNumber} was delayed. Insuree will be issued payment`);
        display("Oracles", "Flight Delayed", [{ label: "Triggering insuree payment for flight: ", error: error, value: flightNumber }]);
      }
    });
  });
})();

function display(title, description, results) {
  let displayDiv = DOM.elid("display-wrapper");
  let section = DOM.section();
  section.appendChild(DOM.h2(title));
  section.appendChild(DOM.h5(description));
  // section.appendChild(DOM.h2({ className: "text-light" }, title));
  // section.appendChild(DOM.h5({ className: "text-white-50" }, description));
  results.map((result) => {
    let row = section.appendChild(DOM.div({ className: "row" }));
    row.appendChild(DOM.div({ className: "col-sm-4 field" }, result.label));
    row.appendChild(DOM.div({ className: "col-sm-8 field-value text-warning" }, result.error ? String(result.error) : String(result.value)));
    section.appendChild(row);
  });
  displayDiv.append(section);
}
