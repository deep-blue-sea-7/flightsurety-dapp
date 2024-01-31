# FlightSurety: Flight Insurance DApp

**Table of Contents**

- [About this Flight Insurance DApp](#about-this-flight-insurance-dapp)
  - [DApp Overview](#dapp-overview)
  - [Main Components](#main-components)
  - [High Level Architecture Diagram](#high-level-architecture-diagram)
- [Requirements and Setup](#requirements-and-setup)
  - [Required Technologies & Libraries](#required-technologies-and-libraries)
  - [Deployment Instructions](#deployment-instructions)
  - [Additional Setup](#additional-setup)
    - [1. Metamask configuration: Import these accounts into Metamask](#1-metamask-configuration-import-these-accounts-into-metamask)
    - [2. Assign the accounts the specific Roles accordingly](#2-assign-the-accounts-the-specific-roles-accordingly)

## About this Flight Insurance DApp

![Frontend Screenshot](/images/dapp-frontend-1.png)
![Frontend Screenshot](/images/dapp-frontend-2.png)

### DApp Overview

This repository contains a decentralized application that offers flight delay insurance to airline passengers.
The main building blocks of this DApp are:

- A Frontend
- The Smart Contracts
- An Oracles Server

Airlines need to be registered and funded. The registration require multi-party concensus after the fourth airline has been registered.
Passengers can pay for insurance up to 1 Ether and in the event of a flight delay, they will receive an isurance payout. Off-chain oracles will communicate with the smart contract when delayed flights occur.

A server will be deployed to simulate communication from Oracles to this DApp. The Oracles server will be listening to such events, and in case of a flight having a delayed status, the Oracles server will notify the DApp on the blockchain, then the smart contract will issue payment to all insurees for that flight.

The frontend has so far implemented part of the capabilities of this dapp as this was a project created with the intention to develop a dapp that has a real life use case such as accepting payments from passengers and paying them back when a delay occurs, and create all the buidling blocks while understanding how the blockchain can communicate with off-chain with systems like oracles.

### Main Components

- **General:**

  - Separation of Concern
    - Separate the smart contracts into an App and a Data smart contract for upgradability.
  - Contracts must have operational status control
    - Restrict who can pause/unpause the contract
    - Every critical state-changing function within smart contracts cannot be executed when the contract is paused.
  - Functions must fail fast
    - Important so that the app would incur as little gas expenditure as possible.

- **Airlines:**

  - The first airline is registered when contract is deployed
  - Once the first airine is funded (paid 10 Ether), it can register other airlines
  - Registered and funded airlines may register a new airline until there are at least four airlines registered
  - Registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines to approve a new airline

- **Flights:**

  - The flights list is defined inside the dapp. We would otherwise need to use premium subscriptions to integrate with an API.
  - The flights have unique codes

- **Passengers:**

  - Passengers may pay up to 1 Ether for purchasing insurance for any flight
  - If a flight is delayed, passengers receives a credit of 1.5X the amount they paid in their account in the smart contract
  - Passenger can then withdraw their payout into their wallet

- **Oracles:**
  - Oracles are implemented as a Node server application
  - Upon startup, 20 oracles are registered
  - This server app mimic real world oracles that would be accessed via an API as follows:
    1. The 'Submit to Oracles' button for a selected flight on the frontend will trigger an event
    2. The event is processed by the smart contract which generates an oracle request event
    3. The oracles matching certain data from the request respond with a status of the flight

### High Level Architecture Diagram

![High Level Architecture Diagram](/diagrams/FlightsuretyArchitecture.png)

## Requirements and Setup

### Required Technologies and Libraries

```
Node v10.7.0
web3 1.0.0-beta.37
Truffle v5.0.2
Solidity 0.4.25
Truffle-hdwallet-provider 1.0.2
Openzeppelin-solidity 1.10.0
webpack 4.6.0
ganache
Metamask
```

### Deployment Instructions

- Install all requisite npm packages:

```
npm install
```

- Launch Ganache UI and update these settings:

```
Port: 8545
Mnemonic: candy maple cake sugar pudding cream honey rich smooth crumble sweet treat
```

- In a separate terminal window, Compile smart contracts:

```
truffle compile
```

- Migrate smart contracts to ganache:

```
truffle migrate --reset
```

- Test the smart contracts:

```
truffle test ./test/flightSurety.js
```

```
truffle test ./test/oracles.js
```

- In a separate terminal window, launch the DApp:

```
npm run dapp
```

- In another terminal window, launch the oracles server:

```
npm run server
```

- To launch the dapp:

```
http://localhost:8000
```

- To build dapp for prod:

```
npm run dapp:prod
```

#### Additional Setup

Ganache addresses have been setup in the following way:

1. Addresses with Index 0-19 => Assigned to Oracles

2. Addresses with Index 20-25 => Assigned to Airlines

3. Addresses with Index 26-30 => Assigned to Passengers

To better track and verify insurance payouts for passengers, it would be best to set up Metamask accounts to match any of the pre-assigned addresses. Here is the list:

- 0x39Ae04B556bbdD73123Bab2d091DCD068144361F
- 0x068729ec4f46330d9Af83f2f5AF1B155d957BD42
- 0x9EE19563Df46208d4C1a11c9171216012E9ba2D0
- 0x04ab41d3d5147c5d2BdC3BcFC5e62539fd7e428B
- 0xeF264a86495fF640481D7AC16200A623c92D1E37
