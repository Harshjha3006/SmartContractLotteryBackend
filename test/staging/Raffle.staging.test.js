const { network, getNamedAccounts, ethers, deployments } = require("hardhat");
const { devChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

devChains.includes(network.name) ?
    describe.skip :
    describe("Raffle Staging test", function () {
        let raffle, deployer, raffleEntranceFee;
        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer;
            raffle = await ethers.getContract("Raffle", deployer);
            raffleEntranceFee = await raffle.getEntranceFee();
        })
        describe("fulfillRandomWords", function () {
            it("picks a winner,resets the lottery,sends money to winner", async function () {
                console.log("Setting up tests ...");
                const startingTimeStamp = await raffle.getLatestTimeStamp();
                const accounts = await ethers.getSigners();
                console.log("Setting up Listener...");
                console.log("Entering Raffle ...");
                const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
                await tx.wait(1);
                console.log("Wait ....");
                const startingBalance = await accounts[0].getBalance();
                await new Promise(async (resolve, reject) => {
                    raffle.once("WinnerPicked", async () => {
                        console.log("WinnerPicked Event Fired!");
                        try {
                            const recentWinner = await raffle.getRecentWinner();
                            const numPlayers = await raffle.getNumPlayers();
                            const raffleState = await raffle.getRaffleState();
                            const endingTimeStamp = await raffle.getLatestTimeStamp();
                            const endingBalance = await accounts[0].getBalance();
                            assert.equal(recentWinner.toString(), accounts[0].address);
                            assert.equal(numPlayers.toString(), "0");
                            assert.equal(raffleState.toString(), "0");
                            assert(endingTimeStamp > startingTimeStamp);
                            assert.equal(endingBalance.toString(), startingBalance.add(raffleEntranceFee).toString());
                            resolve();
                        }
                        catch (e) {
                            reject(e);
                        }
                    })
                })

            })
        })
    })