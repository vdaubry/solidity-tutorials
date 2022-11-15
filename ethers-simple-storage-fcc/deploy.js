const ethers = require("ethers");
const fs = require("fs-extra");
require("dotenv").config();

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const abi = fs.readFileSync(
    "./dist/SimpleStorage_sol_SimpleStorage.abi",
    "utf8"
  );
  const binary = fs.readFileSync(
    "./dist/SimpleStorage_sol_SimpleStorage.bin",
    "utf8"
  );

  /* Deploy with contractFactory */
  const contractFactory = new ethers.ContractFactory(abi, binary, wallet);
  console.log("Deploying...");

  const contract = await contractFactory.deploy();
  await contract.deployTransaction.wait(1);
  console.log(`contract address : ${contract.address}`);

  /* Deploy with manual transaction */
  //   const tx = {
  //     nonce: await wallet.getTransactionCount(),
  //     gasPrice: 20000000000,
  //     gasLimit: 1000000,
  //     to: null,
  //     value: 0,
  //     data: "0x" + binary,
  //     chainId: 1337,
  //   };

  //   const signedTx = await wallet.signTransaction(tx);
  //   console.log(signedTx);

  //   const sentTx = await wallet.sendTransaction(tx);
  //   await sentTx.wait(1);
  //   console.log(sentTx);

  //Get number
  const favoriteNumber = await contract.retrieve();
  console.log(`Favorite number : ${favoriteNumber.toString()}`);

  const txResp = await contract.store("7");
  const txReceipt = await txResp.wait(2);
  const currentFavoriteNumber = await contract.retrieve();
  console.log(`Favorite number : ${currentFavoriteNumber.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
