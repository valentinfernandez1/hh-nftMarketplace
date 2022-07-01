const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Nft Marketplace Tests", () => {
      let nftMarketplace, basicNft, deployer, player
      const PRICE = ethers.utils.parseEther("0.1")
      const TOKEN_ID = 0
      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer
        const accounts = await ethers.getSigners()
        player = accounts[1]

        await deployments.fixture(["all"])
        nftMarketplace = await ethers.getContract("NftMarketplace")
        basicNft = await ethers.getContract("BasicNft")

        await basicNft.mintNft()
        await basicNft.approve(nftMarketplace.address, TOKEN_ID)
      })
      describe("List Items", () => {
        it("Emits an event on listedItem", async () => {
          expect(await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit(
            "ItemListed"
          )
        })

        it("Doesn't allow to list an already listed item", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          const error = `NftMarketplace__AlreadyListed("${basicNft.address}", ${TOKEN_ID})`
          //try to list the same item
          await expect(
            nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWith(error)
        })

        it("Provides an invalid price", async () => {
          const error = `NftMarketplace__PriceMustBeAboveZero()`
          //try to list the item with an invalid price
          await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, 0)).to.be.revertedWith(
            error
          )
        })

        it("Lists and can be bought", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          const playerConnectedNftMarketplace = nftMarketplace.connect(player)

          await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
            value: PRICE,
          })

          const newOwner = await basicNft.ownerOf(TOKEN_ID)
          const deployerProceeds = await nftMarketplace.getProceeds(deployer)

          assert(newOwner.toString() == player.address)
          assert(deployerProceeds.toString() == PRICE.toString())
        })

        it("Only allows owner to list items", async () => {
          const playerConnectedNftMarketplace = nftMarketplace.connect(player)
          const error = "NftMarketplace__NotOwner()"
          await expect(
            playerConnectedNftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWith(error)
        })

        it("Needs approval to list the item", async () => {
          await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
          await expect(
            nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWith("NotApprovedForMarketplace()")
        })
      })
      describe("Cancel Listing", () => {
        it("deletes a listing", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)

          const canceledListing = (
            await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
          )[0].toString()

          assert.equal(canceledListing, "0")
        })

        it("emits event on listing cancel", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          expect(await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.emit(
            "ItemCancel"
          )
        })
        it("Only allows owner to cancel a listing", async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          const playerConnectedNftMarketplace = nftMarketplace.connect(player)
          const error = "NftMarketplace__NotOwner()"
          await expect(
            playerConnectedNftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
          ).to.be.revertedWith(error)
        })

        it("reverts if listing doesn't exist", async () => {
          const error = `NftMarketplace__NotListed("${basicNft.address}", ${TOKEN_ID})`
          await expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.be.revertedWith(
            error
          )
        })
      })
      describe("Buy Item", () => {
        let itemListed, playerConnectedNftMarketplace
        beforeEach(async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          playerConnectedNftMarketplace = nftMarketplace.connect(player)
          itemListed = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
        })
        it("Reverts if price not meet", async () => {
          const LOW_PRICE = ethers.utils.parseEther("0.001")
          const error = `NftMarketplace__PriceNotMet("${
            basicNft.address
          }", ${TOKEN_ID}, ${itemListed.price.toString()})`

          await expect(
            playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
              value: LOW_PRICE,
            })
          ).to.be.revertedWith(error)
        })

        it("Emits event on listing bought", async () => {
          expect(
            await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
              value: PRICE,
            })
          ).to.emit("ItemBought")
        })
        it("Only allows to buy if listed", async () => {
          const error = `NftMarketplace__NotListed("${basicNft.address}", 2)`
          await expect(
            playerConnectedNftMarketplace.buyItem(basicNft.address, 2, {
              value: PRICE,
            })
          ).to.be.revertedWith(error)
        })
        it("Deletes from listings after bought", async () => {
          await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
            value: PRICE,
          })
          const boughtListing = (
            await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
          )[0].toString()

          assert.equal(boughtListing, "0")
        })
      })
      describe("Proceeds", () => {
        beforeEach(async () => {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

          const playerConnectedNftMarketplace = nftMarketplace.connect(player)

          await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
            value: PRICE,
          })
        })
        it("withdraws its proceeds", async () => {
          await nftMarketplace.withdrawProceeds()
          const endingProceeds = await nftMarketplace.getProceeds(deployer)
          assert.equal(endingProceeds.toString(), "0")
        })
        it("Reverts if no proceeds available", async () => {
          await nftMarketplace.withdrawProceeds()
          const error = `NftMarketplace__NoProceeds()`

          await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith(error)
        })
      })
    })
