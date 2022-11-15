const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts } = require("hardhat");

describe("fundme", async () => {
  let fundMe;
  let deployer;
  let mockV3Aggregator;
  let accounts;
  const sendValue = ethers.utils.parseEther("1");

  beforeEach(async () => {
    accounts = await ethers.getSigners(); // Get accounts from hardhat config networks accounts
    deployer = (await getNamedAccounts()).deployer;
    await deployments.fixture(["all"]);
    fundMe = await ethers.getContract("FundMe", deployer);
    mockV3Aggregator = await ethers.getContract("MockV3Aggregator", deployer);
  });
  describe("constructor", async () => {
    it("sets aggregator address", async () => {
      const response = await fundMe.getPriceFeed();
      assert.equal(response, mockV3Aggregator.address);
    });
  });

  describe("fund", function () {
    // https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
    // could also do assert.fail
    it("Fails if you don't send enough ETH", async () => {
      await expect(fundMe.fund()).to.be.revertedWith(
        "You need to spend more ETH!"
      );
    });

    it("Updates the amount funded data structure", async () => {
      await fundMe.fund({ value: sendValue });
      const response = await fundMe.getAddressToAmountFunded(deployer); // addressToAmountFunded is updated with msg.sender (= deployer)
      assert.equal(response.toString(), sendValue.toString());
    });

    it("adds deployer to funders array", async () => {
      await fundMe.fund({ value: sendValue });
      const funder = await fundMe.getFunder(0);

      assert.equal(funder, deployer);
    });
  });

  describe("withdraw", async () => {
    beforeEach(async () => {
      await fundMe.fund({ value: sendValue });
    });

    it("can withdraw if owner is calling", async () => {
      const fundMeStartingBalance = await ethers.provider.getBalance(
        fundMe.address
      );
      const deployerStartingBalance = await ethers.provider.getBalance(
        deployer
      );

      const txResp = await fundMe.withdraw();
      const txReceipt = await txResp.wait(1);
      const { gasUsed, effectiveGasPrice } = txReceipt;
      const totalGasCost = gasUsed.mul(effectiveGasPrice);

      const fundMeEndingBalance = await ethers.provider.getBalance(
        fundMe.address
      );
      const deployerEndingBalance = await ethers.provider.getBalance(deployer);

      assert.equal(fundMeEndingBalance, 0);
      assert.equal(
        deployerEndingBalance.toString(),
        deployerStartingBalance
          .add(fundMeStartingBalance)
          .sub(totalGasCost)
          .toString() // deployerStartingBalance is a BigNumber
      );
    });

    it("allows us to withdraw with multiple funders", async () => {
      for (let i = 1; i < 6; i++) {
        const connectedFundMeContract = await ethers.getContract(
          "FundMe",
          accounts[i]
        );
        await connectedFundMeContract.fund({ value: sendValue });
      }

      const fundMeStartingBalance = await ethers.provider.getBalance(
        fundMe.address
      );
      const deployerStartingBalance = await ethers.provider.getBalance(
        deployer
      );

      const txResp = await fundMe.withdraw();
      const txReceipt = await txResp.wait(1);

      const { gasUsed, effectiveGasPrice } = txReceipt;
      const totalGasCost = gasUsed.mul(effectiveGasPrice);
      const fundMeEndingBalance = await ethers.provider.getBalance(
        fundMe.address
      );
      const deployerEndingBalance = await ethers.provider.getBalance(deployer);

      assert.equal(fundMeEndingBalance, 0);
      assert.equal(
        deployerEndingBalance.toString(),
        deployerStartingBalance
          .add(fundMeStartingBalance)
          .sub(totalGasCost)
          .toString() // deployerStartingBalance is a BigNumber
      );
      await expect(fundMe.getFunder(0)).to.be.reverted; // funders should be reseted to emoty array

      for (let i = 1; i < 6; i++) {
        const accountBalance = await fundMe.getAddressToAmountFunded(
          accounts[i].address
        );
        assert.equal(accountBalance, 0);
      }
    });

    it("only allow the owner to withdraw", async () => {
      const attacker = accounts[1];
      const connectedFundMeContract = await fundMe.connect(attacker);

      await expect(
        connectedFundMeContract.withdraw()
      ).to.be.revertedWithCustomError(fundMe, "FundMe__NotOwner");
    });
  });
});
