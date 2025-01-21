![Image](images/SDCU.png "Super Simple Contract UI")

# Smart Contract Interaction using alternative Front End

<h4 align="center">
  <a href="https://shortcut-sc-nextjs.vercel.app/">Website</a>
</h4>

Background

This webpage serves as a quick tool for users who wish to interact directly with smart contracts, particularly in instances where there may be a front-end failure for dApps. While several applications exist for interacting with smart contracts, the author believes there should be a simpler and, ideally, faster method to transact with the blockchain. Blockchains, such as Ethereum, have been operating continuously since their inception, and so does the importance of a shortcut for transactions when it's needed most.

⚙️ Built using NextJS, RainbowKit, Hardhat, Wagmi, Viem, and Typescript.

## Requirements

Before you begin, you need to install the following tools:

- [Node (>= v18.17)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

## Quickstart

This repo uses the same format as Scaffold-ETH 2, you can find similar steps below from the original repo:

1. Clone this repo & install dependencies

```
git clone https://github.com/muhammadaus/SuperSimpleContractUI.git
cd SuperSimpleContractUI
yarn install
```

2. Run a local network and deploy contract to the local network:

This will have the same steps from the original repo and only needed if you want to test contracts locally.

Original repo: <a href="https://github.com/scaffold-eth/scaffold-eth-2">Scaffold Eth 2</a>

3. Start your NextJS app:

```
yarn start
```

Visit your app on: `http://localhost:3000`. You can interact with your smart contract using the `Read/Write Contracts` page.

# Main Page

This project is a front end that can interact with any smart contracts. You just need the smart contract address, the ABI, and the network it is deployed to. Load the necessary contract address, ABI, and network selection.
Read/Write Page

# Read/Write Page

The smart contract will be read/written using RPC connected from the browser wallet. The necessary parameters are unlike typical web3 frontends which require the exact input from smart contracts. Ensure that the number of parameters passed is exactly as in the function of the smart contracts.

    Read: Insert the required address or parameters to read a function.
    Write: Insert the necessary parameters to write into the blockchain, such as sending ether, making a swap, or minting an NFT.
