import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { SimpleStorage, SimpleStorage__factory } from "../typechain-types";

describe("SimpleStorage", () => {
  let simpleStorage: SimpleStorage;
  let simpleStorageFactory: SimpleStorage__factory;

  beforeEach(async () => {
    simpleStorageFactory = (await ethers.getContractFactory(
      "SimpleStorage"
    )) as SimpleStorage__factory;
    simpleStorage = await simpleStorageFactory.deploy();
  });

  it("should start with a favorite number of 0", async () => {
    const currentValue = await simpleStorage.retrieve();
    const expectedValue = "0";

    assert.equal(currentValue, expectedValue);
  });

  it("should update favorite number", async () => {
    const expectedValue = 7;

    const txResp = await simpleStorage.store(7);
    await txResp.wait(1);

    const currentValue = await simpleStorage.retrieve();
    assert.equal(currentValue, expectedValue);
  });
});
