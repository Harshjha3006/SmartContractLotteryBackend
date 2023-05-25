const { network, ethers } = require("hardhat");
const { devChains } = require("../helper-hardhat-config")


const BASE_FEE = ethers.utils.parseEther("0.25");
const GAS_PRICE_LINK = 1e9;

module.exports =
    async function ({ getNamedAccounts, deployments }) {
        const args = [BASE_FEE, GAS_PRICE_LINK];
        const { deploy, log } = deployments;
        const { deployer } = await getNamedAccounts();
        if (devChains.includes(network.name)) {
            log("Local Network Detected!");
            log("Deploying Mocks ...");
            await deploy("VRFCoordinatorV2Mock", {
                from: deployer,
                args: args,
                log: true
            });
            log("Mocks Deployed!");
            log("-------------------------------");
        }
    }

module.exports.tags = ["all", "mocks"];