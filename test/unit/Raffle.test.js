const { network, getNamedAccounts, ethers, deployments } = require("hardhat");
const { devChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!devChains.includes(network.name) ?
    describe.skip :
    describe("Raffle", function () {
        let raffle, vrfCoordinatorV2Mock, deployer, chainId, raffleEntranceFee, interval;
        beforeEach(async function () {
            chainId = network.config.chainId;
            deployer = (await getNamedAccounts()).deployer;
            await deployments.fixture(["all"]);
            raffle = await ethers.getContract("Raffle", deployer);
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
            raffleEntranceFee = await raffle.getEntranceFee();
            interval = await raffle.getInterval();
        })
        describe("constructor", function () {
            it("raffle is intialised correctly", async function () {
                const raffleState = await raffle.getRaffleState();
                assert.equal(raffleState.toString(), "0");
                assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
            })
        })
        describe("enterRaffle", function () {
            it("reverts when you don't pay enough", async function () {
                await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughEth");
            })
            it("records player when they enter", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                const playerFromRaffle = await raffle.getPlayer(0);
                assert.equal(playerFromRaffle, deployer);
            })
            it("emits an event after enter", async function () {
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter");
            })
            it("not able to enter if raffle is not open", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                // We pretend to be a Chainlink keeper
                await raffle.performUpkeep([]);
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith("Raffle__NotOpen");
            })
        })
        describe("checkUpkeep", function () {
            it("returns false when there is not eth", async function () {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                assert(!upKeepNeeded);
            })
            it("returns false when raffle is not open", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                await raffle.performUpkeep([]);
                const { upKeepNeeded } = await raffle.callStatic.checkUpkeep([]);
                const raffleState = await raffle.getRaffleState();
                assert.equal(raffleState.toString(), "1");
                assert(!upKeepNeeded);
            })
        })
        describe("performUpkeep", function () {
            it("it can only run if checkUpkeep is true", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                const tx = await raffle.performUpkeep([]);
                assert(tx);
            })
            it("reverts when checkUpKeep return false", async function () {
                await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__NoUpKeepNeeded");
            })
            it("changes state,emits event,calls vrf", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
                const tx = await raffle.performUpkeep([]);
                const txReceipt = await tx.wait(1);
                const raffleState = await raffle.getRaffleState();
                const requestId = txReceipt.events[1].args.requestId;
                assert(requestId > 0);
                assert(raffleState.toString(), "1");
            })
        })
        describe("fulfillRandomWords", function () {
            beforeEach(async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee });
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                await network.provider.send("evm_mine", []);
            })
            it("can only be called after performUpkeep", async function () {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request");
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request");
            })
            it("picks a winner ,resets the lottery, sends money", async function () {
                const accounts = await ethers.getSigners();
                for (let i = 1; i < 4; i++) {
                    const accountConnectedContract = await raffle.connect(accounts[i]);
                    await accountConnectedContract.enterRaffle({ value: raffleEntranceFee });
                }
                const startingTimeStamp = await raffle.getLatestTimeStamp();
                const tx = await raffle.performUpkeep([]);
                const txReceipt = await tx.wait(1);
                await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address);
                await new Promise(async (resolve, reject) => {
                    raffle.once("WinnerPicked", async () => {
                        console.log("Found The event!");
                        try {
                            const recentWinner = await raffle.getRecentWinner();
                            const raffleState = await raffle.getRaffleState();
                            const numPlayers = await raffle.getNumPlayers();
                            const endingTimeStamp = await raffle.getLatestTimeStamp;
                            assert.equal(raffleState.toString(), "0");
                            assert.equal(numPlayers.toString(), "0");
                            assert(endingTimeStamp > startingTimeStamp);
                            resolve();
                        } catch (e) {
                            reject(e);
                        }
                    })
                })


            })
        })
    })