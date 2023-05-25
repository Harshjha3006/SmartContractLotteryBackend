const { network, ethers } = require("hardhat");
const { devChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const FUND_AMOUNT = ethers.utils.parseEther("1");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    let vrfCoordinatorV2address, subscriptionId;
    if (devChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2address = vrfCoordinatorV2Mock.address;
        const txResponse = await vrfCoordinatorV2Mock.createSubscription();
        const txReceipt = await txResponse.wait(1);
        subscriptionId = txReceipt.events[0].args.subId;
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT);
    }
    else {
        vrfCoordinatorV2address = networkConfig[chainId]["vrfCoordinatorV2Address"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }
    const args = [
        vrfCoordinatorV2address,
        networkConfig[chainId]["entranceFee"],
        networkConfig[chainId]["gasLane"],
        subscriptionId,
        networkConfig[chainId]["callBackGasLimit"],
        networkConfig[chainId]["interval"]
    ];
    const raffleContract = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1
    })
    log("Raffle Deployed");
    log("----------------------------------");

    if (devChains.includes(network.name)) {
        const vrfCoordinatorV2 = await ethers.getContract(
            "VRFCoordinatorV2Mock"
        );
        await vrfCoordinatorV2.addConsumer(subscriptionId, raffleContract.address);
    }
    if (!devChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying ...");
        await verify(raffleContract.address, args);
    }
}
module.exports.tags = ["all", "raffle"];