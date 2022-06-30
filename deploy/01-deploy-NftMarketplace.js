const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    const chainId = network.config.chainId

    log("------------------------------------------\n")
    log(`Deploying NftMarketplace contract to chain: ${chainId} - ${network.name}.... `)

    const args = []
    const nftMarketplace = await deploy("NftMarketplace", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("------------------------------------------\n")
        log("Verifying please wait\n")
        await verify(nftMarketplace.address, args)
        log("------------------------------------------")
    }
}

module.exports.tags = ["all", "main", "marketplace"]
