module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,        // Ganache GUI default port
      network_id: "*",   // Match any network id
    },
    ganache_cli: {
      host: "127.0.0.1",
      port: 8545,        // ganache-cli default port
      network_id: "*",
    }
  },
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
};