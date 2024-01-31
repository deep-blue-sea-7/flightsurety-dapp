var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
var NonceTrackerSubprovider = require("web3-provider-engine/subproviders/nonce-tracker");

module.exports = {
  networks: {
    // For testing with truffle locally. HDWalletProvider causes nonce tracking issues
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
      gas: 9999999,
    },

    // For testing with Ganache UI
    // development: {
    //   provider: function () {
    //     return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
    //   },
    //   network_id: "*",
    //   gas: 9999999,
    // },
  },
  compilers: {
    solc: {
      version: "^0.4.25",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
  solidityLog: {
    displayPrefix: " :", // defaults to ""
    preventConsoleLogMigration: true, // defaults to false
  },
};
