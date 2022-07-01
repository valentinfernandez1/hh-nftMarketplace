const { network, ethers } = require("hardhat")
const fs = require("fs")

const frontendContractsFile = "../nft-marketplace/constants/networkMapping.json"

module.exports = async () => {
  if (process.env.UPDATE_FRONTEND) {
    console.log("Updating Frontend...")
    await updateContractAddresses()
  }
}

const updateContractAddresses = async () => {
  const nftMarketplace = await ethers.getContract("NftMarketplace")
  const chainId = network.config.chainId.toString()
  const contractAddresses = JSON.parse(fs.readFileSync(frontendContractsFile, "utf-8"))

  if (chainId in contractAddresses) {
    if (!contractAddresses[chainId]["NftMarketplace"].includes(nftMarketplace.address)) {
      contractAddresses[chainId]["NftMarketplace"].push(nftMarketplace.address)
    }
  } else {
    contractAddresses[chainId] = { NftMarketplace: [nftMarketplace.address] }
  }
  fs.writeFileSync(frontendContractsFile, JSON.stringify(contractAddresses))
}

module.exports.tags = ["all", "frontend"]
