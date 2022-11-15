const hre = require("hardhat");

async function main() {
  await hre.run("compile");

  const SimpleStorage = await hre.ethers.getContractFactory("SimpleStorage");
  const simpleStorage = await SimpleStorage.deploy();
  await simpleStorage.deployed();

  const txResp = await simpleStorage.store(7);
  const txReceipt = await txResp.wait(1);

  console.log(txReceipt);
  console.log(txReceipt.events[0].args.oldNumber.toString());
  console.log(txReceipt.events[0].args.newNumber.toString());
  console.log(txReceipt.events[0].args.addedNumber.toString());
  console.log(txReceipt.events[0].args.sender);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
