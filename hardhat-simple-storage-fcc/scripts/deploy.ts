import { ethers, run, network } from "hardhat";
import fs from "fs-extra";
import "dotenv/config";

async function main() {
  const contractFactory = await ethers.getContractFactory("SimpleStorage");
  console.log("Deploying...");

  const contract = await contractFactory.deploy();
  await contract.deployed();
  console.log(`contract address : ${contract.address}`);

  if (network.config.chainId == 5 && process.env.ETHERSCAN_API_KEY) {
    await contract.deployTransaction.wait(6);
    verify(contract.address, []);
  }

  //Get number
  const favoriteNumber = await contract.retrieve();
  console.log(`Favorite number : ${favoriteNumber.toString()}`);

  const txResp = await contract.store(7);
  await txResp.wait(1);
  const currentFavoriteNumber = await contract.retrieve();
  console.log(`Favorite number : ${currentFavoriteNumber.toString()}`);
}

async function verify(contractAddress: string, args: any[]) {
  console.log("Verifying contract...");

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e: any) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Contract already verified");
    } else {
      console.log(e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
