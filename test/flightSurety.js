var Test = require("../config/testConfig.js");
var BigNumber = require("bignumber.js");
var Web3 = require("web3");

contract("Flight Surety Tests", async (accounts) => {
  var config;
  before("setup contract", async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
    // Ensure that access is denied for non-Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyData.setOperatingStatus(false, {
        from: config.testAddresses[2],
      });
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
    // Ensure that access is allowed for Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyData.setOperatingStatus(false);
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
    await config.flightSuretyData.setOperatingStatus(false);

    let reverted = false;
    try {
      await config.flightSurety.setTestingMode(true);
    } catch (e) {
      reverted = true;
    }
    assert.equal(reverted, true, "Access not blocked for requireIsOperational");

    // Set it back for other tests to work
    await config.flightSuretyData.setOperatingStatus(true);
  });

  it("(airline) cannot register an Airline using registerAirline() if it is not funded", async () => {
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(newAirline, {
        from: config.firstAirline,
      });
    } catch (e) {}
    let result = await config.flightSuretyApp.isAirlineRegistered.call(newAirline);

    // ASSERT
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");
  });

  it("(airline) can fund the contract", async () => {
    try {
      await config.flightSuretyApp.fund({
        from: config.firstAirline,
        value: config.fundingAmount,
      });
    } catch (e) {
      console.log(e);
    }
    let result = await config.flightSuretyApp.isAirlineFunded.call(config.firstAirline);

    assert.equal(result, true, "Airline has provided funding");
  });

  it("(airline) can register the first four airlines by any registered and funded airline", async () => {
    // Until now, only the firstAirline (i.e. accounts[1]) is registered and funded
    // -> can register other airlines

    // ARRANGE
    let airline2 = accounts[2];
    let airline3 = accounts[3];
    let airline4 = accounts[4];

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(airline2, {
        from: config.firstAirline,
      });
      await config.flightSuretyApp.registerAirline(airline3, {
        from: config.firstAirline,
      });
      await config.flightSuretyApp.registerAirline(airline4, {
        from: config.firstAirline,
      });
    } catch (e) {
      console.log(e);
    }

    let result2 = await config.flightSuretyApp.isAirlineRegistered.call(airline2);
    let result3 = await config.flightSuretyApp.isAirlineRegistered.call(airline3);
    let result4 = await config.flightSuretyApp.isAirlineRegistered.call(airline4);

    // ASSERT
    assert.equal(result2, true, "The Airline was successfully registered.");
    assert.equal(result3, true, "The Airline was successfully registered.");
    assert.equal(result4, true, "The Airline was successfully registered.");
  });

  it("(airline) need multi-party concensus to register an Airline but have not reached 50% votes", async () => {
    // Now we have four registered airlines (i.e. accounts[1], accounts[2], accounts[3], accounts[4])
    // -> can register other airlines (for instance accounts[5]) only through multi-party concensus
    // But we don't have enough votes yet

    // ARRANGE
    let airline2 = accounts[2];
    let airline3 = accounts[3];
    let airline4 = accounts[4];
    let airline5 = accounts[5];

    // Fund the registered and unfunded airlines
    try {
      await config.flightSuretyApp.fund({
        from: airline2,
        value: config.fundingAmount,
      });
      await config.flightSuretyApp.fund({
        from: airline3,
        value: config.fundingAmount,
      });
      await config.flightSuretyApp.fund({
        from: airline4,
        value: config.fundingAmount,
      });
    } catch (e) {
      console.log(e);
    }

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(airline5, {
        from: config.firstAirline,
      });
    } catch (e) {
      console.log(e);
    }

    let result5 = await config.flightSuretyApp.isAirlineRegistered.call(airline5);

    // ASSERT
    assert.equal(result5, false, "The Airline was not registered because concensus was not reached");
  });

  it("(airline) need multi-party concensus to register an Airline and we have reached 50% votes", async () => {
    // Now we have four registered airlines (i.e. accounts[1], accounts[2], accounts[3], accounts[4])
    // -> can register other airlines (for instance accounts[5]) only through multi-party concensus
    // We can register the airline because we have at least half the airlines votes

    // ARRANGE
    let airline2 = accounts[2];
    let airline5 = accounts[5];

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(airline5, {
        from: airline2,
      });
    } catch (e) {
      console.log(e);
    }

    let result5 = await config.flightSuretyApp.isAirlineRegistered.call(airline5);

    // ASSERT
    assert.equal(result5, true, "The Airline should be registered after concensus was reached");
  });

  it("(passenger) can buy insurance for 1 ether or less", async () => {
    // ARRANGE
    let flightName = "Air Atlas";
    let airline2 = accounts[2];
    let timeStamp = 1705006147;
    let passengerAccount = accounts[6];
    let insuranceAmount = web3.utils.toWei("0.7", "ether");

    // ACT
    try {
      await config.flightSuretyApp.registerFlight(airline2, flightName, timeStamp, { from: airline2 });

      await config.flightSuretyApp.buy(flightName, airline2, timeStamp, {
        from: passengerAccount,
        value: insuranceAmount,
      });
    } catch (e) {
      console.log(e);
    }

    let flightKey = await config.flightSuretyData.getFlightKey(airline2, flightName, timeStamp);

    let amount = await config.flightSuretyData.getPassengerPayment(passengerAccount, flightKey);

    let result = await config.flightSuretyData.isPassengerInsured(passengerAccount, flightKey);

    // ASSERT
    assert.equal(result, true, "Passenger should be able to buy an insurance.");
  });

  it("(passenger) can be credited the going percentage rate * their contribution", async () => {
    // Passenger accounts[6] has paid for insurance

    // ARRANGE
    let flightName = "Air Atlas";
    let airline2 = accounts[2];
    let timeStamp = 1705006147;
    let passengerAccount = accounts[6];
    let insurancePayoutPercentage = 150;
    let flightKey = await config.flightSuretyData.getFlightKey(airline2, flightName, timeStamp);
    let passengerPayment = await config.flightSuretyData.getPassengerPayment(passengerAccount, flightKey);

    // ACT
    try {
      await config.flightSuretyData.creditInsurees(airline2, flightName, timeStamp, insurancePayoutPercentage);
    } catch (e) {
      console.log(e);
    }

    let passengerBalance = await config.flightSuretyData.getPassengerBalance(passengerAccount);

    // ASSERT
    assert.equal(passengerBalance, (passengerPayment * insurancePayoutPercentage) / 100, "Passenger should have been credited.");
  });

  it("(passenger) can withdraw the amount paid out by the insurance", async () => {
    // Passenger accounts[6] has paid for insurance and was issued a payment into their account

    //ARRANGE
    let paymentDue = Web3.utils.toWei("1.05", "ether");
    let passengerAccount = accounts[6];
    let passengerStartingBalance = BigNumber(await web3.eth.getBalance(passengerAccount));
    const amount = 1;

    let passengerAccountBalance = await config.flightSuretyData.getPassengerBalance(passengerAccount);

    // ACT
    try {
      result = await config.flightSuretyApp.withdraw(passengerAccount, {
        from: passengerAccount,
      });

      // Function to get gas paid for a transaction
      // https://stackoverflow.com/questions/71646915/test-for-smart-contract-solidity-truffle
      const getGas = async (result) => {
        const tx = await web3.eth.getTransaction(result.tx);
        const gasUsed = web3.utils.toBN(result.receipt.gasUsed);
        const gasPrice = web3.utils.toBN(tx.gasPrice);
        const gas = gasUsed.mul(gasPrice);
        return gas;
      };

      gasPaid = await getGas(result);
    } catch (e) {
      console.log(e);
    }

    // ASSERT
    let passengerEndingBalance = BigNumber(await web3.eth.getBalance(passengerAccount));

    expectedPaymentDue = passengerEndingBalance - (passengerStartingBalance - gasPaid);
    assert.equal(expectedPaymentDue, paymentDue, "The ending balance for the insuree should have been increased.");
  });
});
