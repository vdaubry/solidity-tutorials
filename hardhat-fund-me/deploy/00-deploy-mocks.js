const { network } = require("hardhat");
const {
  developmentChains,
  DECIMALS,
  INITIAL_ANSWER,
} = require("../helper-hardhat-config");

module.exports = async (hre) => {
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainName = network.name;
  const chainid = network.config.chainId;

  log(`chainName = ${chainName}`);
  log(`chainId = ${chainid}`);

  if (developmentChains.includes(chainName)) {
    log("Local network detected : deploying mocks");
    await deploy("MockV3Aggregator", {
      contract: "MockV3Aggregator",
      from: deployer,
      log: true,
      args: [DECIMALS, INITIAL_ANSWER],
    });
    log("Mock deployed!");
    log("-------------------------------");
  }
};

module.exports.tags = ["all", "mocks"];
