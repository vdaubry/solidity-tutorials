const { assert, expect } = require("chai")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

console.log(`current network ${network.name}`)

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", () => {
          let raffle, vrfCoordinatorV2Mock, deployer, entranceFee, accounts, interval
          const chainId = network.config.chainId

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              interval = await raffle.getInterval()
              entranceFee = ethers.utils.parseEther("0.02")
          })

          const prepareUpkeep = async () => {
              //Enter raffle to add a player + fund the balance
              await raffle.enterRaffle({ value: entranceFee })

              // Move time to next interval
              await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
              await network.provider.send("evm_mine", [])
          }

          describe("constructor", () => {
              it("initializes the raffle", async () => {
                  const raffleState = await raffle.getRaffleState()
                  const entranceFee = await raffle.getEntranceFee()
                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["keepersUpdateInterval"])
                  assert.equal(entranceFee.toString(), networkConfig[chainId]["raffleEntranceFee"])
              })
          })

          describe("enterRaffle", () => {
              it("requires minimum entrance fee", async () => {
                  entranceFee = ethers.utils.parseEther("0.001")
                  await expect(raffle.enterRaffle({ value: entranceFee })).to.be.revertedWith(
                      "Raffle__NotEnoughEthEnteredError"
                  )
              })

              it("adds player", async () => {
                  await raffle.enterRaffle({ value: entranceFee })
                  const player = await raffle.getPlayer(0)

                  assert.equal(player, deployer)

                  const connectContract1 = await raffle.connect(accounts[1])
                  await connectContract1.enterRaffle({ value: entranceFee })
                  const player1 = await connectContract1.getPlayer(1)

                  assert.equal(player1, accounts[1].address)
              })

              it("emits event on enter raffle", async () => {
                  await expect(raffle.enterRaffle({ value: entranceFee })).to.emit(
                      raffle,
                      "RaffleEntered"
                  )
              })

              it("doesnt allow to enter raffle is state is not OPEN", async () => {
                  await prepareUpkeep()

                  // Set state to calculating
                  await raffle.performUpkeep([])

                  await expect(raffle.enterRaffle({ value: entranceFee })).to.be.revertedWith(
                      "Raffle__RaffleNotOpenError"
                  )
              })
          })

          describe("checkUpkeep", () => {
              it("returns true when conditions are met", async () => {
                  await prepareUpkeep()

                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]) // checkUpkeep is not a view, to simulate te transaction and get the returned value we need to use callstatic

                  assert(upKeepNeeded)
              })

              it("returns false when no player entered the game", async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])

                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]) // checkUpkeep is not a view, to simulate te transaction and get the returned value we need to use callstatic

                  assert(!upKeepNeeded)
              })

              it("returns false before interval", async () => {
                  await raffle.enterRaffle({ value: entranceFee })

                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]) // checkUpkeep is not a view, to simulate te transaction and get the returned value we need to use callstatic

                  assert(!upKeepNeeded)
              })

              it("returns false if raffle is not open", async () => {
                  await prepareUpkeep()

                  // Set state to calculating
                  await raffle.performUpkeep([])

                  const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]) // checkUpkeep is not a view, to simulate te transaction and get the returned value we need to use callstatic

                  assert(!upKeepNeeded)
              })
          })

          describe("performUpkeep", () => {
              it("runs if upkeep is true", async () => {
                  await prepareUpkeep()

                  const txResp = await raffle.performUpkeep([])

                  assert(txResp)
              })

              it("reverts if needUpkeep is false", async () => {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__upkeepNotReady"
                  )
              })

              it("sets state to calculating", async () => {
                  await prepareUpkeep()
                  const txResp = await raffle.performUpkeep([])

                  const state = await raffle.getRaffleState()
                  assert.equal(state.toString(), "1")
              })

              it("emits RequestraffleWinner event", async () => {
                  await prepareUpkeep()

                  await expect(raffle.performUpkeep([])).to.emit(raffle, "RequestraffleWinner")
              })

              it("send requestId in RequestraffleWinner event", async () => {
                  await prepareUpkeep()
                  const txResp = await raffle.performUpkeep([])
                  const txReceipt = await txResp.wait(1)
                  const requestId = txReceipt.events[1].args.RequestId

                  assert(requestId.toNumber() > 0)
              })
          })

          describe("pickWinner", () => {
              const doUpKeep = async () => {
                  await prepareUpkeep()
                  const txResp = await raffle.performUpkeep([])
                  const txReceipt = await txResp.wait(1)
                  return txReceipt.events[1].args.RequestId
              }

              it("sets current winner", async () => {
                  const requestId = await doUpKeep()

                  await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address)
                  const winner = await raffle.getCurrentWinner()

                  assert.equal(winner, deployer)
              })

              it("resets raffle state", async () => {
                  const requestId = await doUpKeep()

                  await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address)
                  const state = await raffle.getRaffleState()

                  assert.equal(state.toString(), "0")
              })

              it("updates timestamp", async () => {
                  const requestId = await doUpKeep()

                  const startingTimestamp = await raffle.getLastRaffleTimestamp()

                  await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address)

                  const endingTimestamp = await raffle.getLastRaffleTimestamp()

                  assert(endingTimestamp > startingTimestamp)
              })

              it.only("sends balance to winner", async () => {
                  const requestId = await doUpKeep()

                  const startingUserBalance = await ethers.provider.getBalance(deployer)
                  const startingRaffleBalance = await ethers.provider.getBalance(raffle.address)

                  await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address)

                  const endingUserBalance = await ethers.provider.getBalance(deployer)
                  const endingRaffleBalance = await ethers.provider.getBalance(raffle.address)

                  assert.equal(endingRaffleBalance.toString(), "0")
                  assert(endingUserBalance > startingUserBalance)
              })
          })
      })
