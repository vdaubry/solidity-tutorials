const { network } = require("hardhat");
const {
  networkConfig,
  developmentChains,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

module.exports = async (hre) => {
  console.log("Deploying...");

  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  const chainName = network.name;

  let ethUsdPriceFeddAddress;
  if (developmentChains.includes(chainName)) {
    const ethUsdAggregator = await deployments.get("MockV3Aggregator");
    ethUsdPriceFeddAddress = ethUsdAggregator.address;
  } else {
    ethUsdPriceFeddAddress = networkConfig[chainId]["ethUsdPriceFeddAddress"];
  }

  const args = [ethUsdPriceFeddAddress];
  const fundMe = await deploy("FundMe", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });
  log("---------------------------------------");

  if (!developmentChains.includes(chainName) && process.env.ETHERSCAN_API_KEY) {
    await verify(fundMe.address, args);
  }
};

module.exports.tags = ["all", "fundme"];
