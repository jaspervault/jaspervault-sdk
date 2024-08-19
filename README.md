# JasperVault SDK

## Installation

Before you start, make sure your system has Node.js installed. You can install the JasperVault SDK using npm (Node Package Manager) with the following command:

```bash
npm install @jaspervault/jvault.js
```

```bash
yarn add @jaspervault/jvault.js
```

## Getting Started

```javascript
const { JVault } = require("@jaspervault/jvault.js");
const ADDRESSES = require("@jaspervault/jvault.js/dist/src/utils/coreAssets.json");
const config = require("@jaspervault/jvault.js/dist/src/api/config/arbitrum.json");
const { OptionType } = require("@jaspervault/jvault.js/dist/src/utils/types/index");
const ethers = require('ethers');

exports.demo = async ctx => {
  ctx.status = 200;
  let config_holder = {
    ethersProvider: new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc"),
    ethersSigner: new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER,
      new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc")),
    network: 'arbitrum',
    EOA: new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER,
      new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc")).address
  };
  let feeData = await config_holder.ethersProvider.getFeeData();

  let jVault_holder = new JVault(config_holder);
  let optionVault = await jVault_holder.VaultAPI.createNewVault(jVault_holder.EOA, {
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
  });
  console.log(`optionVault: ${optionVault}`);
  let vaults_1 = await jVault_holder.VaultAPI.getAddress(jVault_holder.EOA, 1);
  if (optionVault != ethers.constants.AddressZero) {
    try {
      let writer_config = await jVault_holder.OptionTradingAPI.getOptionWriterSettings();
      let tx = await jVault_holder.OptionTradingAPI.InitializeVaultAndplaceOrder({
        amount: ethers.utils.parseEther('100'),
        underlyingAsset: ADDRESSES.arbitrum.ARB,
        optionType: OptionType.CALL,
        premiumAsset: ADDRESSES.arbitrum.USDT,
        optionVault: optionVault,
        optionWriter: writer_config.arbitrum.CALL.ARB,
        premiumVault: vaults_1,
        chainId: config.chainId,
        secondsToExpiry: 3600 * 2
      }, {
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
      });
      if (tx) {
        console.log(`order TX: ${tx.hash}`);
        await tx.wait(1);
        let order = await jVault_holder.OptionTradingAPI.getOrderByHash(tx.hash);
        console.log(order);
      }
    }
    catch (error) {
      console.error(`call order failed: ${error}`);
    }
  }
  ctx.body = db.users;
};
```

Alternatively, you can run the demo code found in the `script` directory.

```bash
npx ts-node scripts/task_arbitrum.ts
```

If everything is running correctly, you should see the following output:

```bash
Holder Signer:0x11890834531Ad1127863895Fa83983BfC6347BB0
vaults_1: 0xf95E732987c1Fbd8b88d1848bCb3326f79641a87
Starting place order
optionVault: 0x51a94a6CAB331c2B177dDDED4813E465E7b5223E
Initializing vault: 0x51a94a6CAB331c2B177dDDED4813E465E7b5223E 7
vault_type: 7
order TX: 0x330e319159cee5339b02aa554d5892d84c1458dbe4a7fe7b8c430c4cac6f2847
{
  transactionHash: '0x330e319159cee5339b02aa554d5892d84c1458dbe4a7fe7b8c430c4cac6f2847',
  timestamp: '1724054664',
  orderDetail: {
    expirationDate: '1724061860',
    holder: '0x51a94a6cab331c2b177ddded4813e465e7b5223e',
    id: '28245',
    liquidateMode: 1,
    lockAmount: '1000000000000000000',
    lockAsset: '0x912ce59144191c1204e64559fe8253a0e49e6548',
    lockAssetType: 1,
    lockDate: '1724061860',
    quantity: '100000000000000000000',
    recipient: '0xf95e732987c1fbd8b88d1848bcb3326f79641a87',
    strikeAmount: '537031',
    strikeAsset: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    underlyingAsset: '0x912ce59144191c1204e64559fe8253a0e49e6548',
    underlyingNftID: '0',
    writer: '0x1eb466780e412c796a7beda541cff47e0571a000'
  },
  orderId: '28245',
  holderWallet: '0x11890834531ad1127863895fa83983bfc6347bb0',
  writerWallet: '0xaff6ed316a7975c247f65e401e4f0aab183206f7'
}
```

## Create a Vault

The **Externally Owned Account (EOA)** corresponding to the private key will serve as the owner of the Smart Account we create. You can get the private key from wallets like MetaMask, TrustWallet, Coinbase Wallet, etc. 🔑

Create an .evn file, copy the following code in it and replace the `PRIVATE_KEY`.

> **Be sure to never publicly expose your private key.**

```bash
PRIVATE_KEY_HOLDER=YOUR_PRIVATE_KEY

PRIVATE_KEY_WRITER=YOUT_PRIVATE_KEY
```

The code below demonstrates how to check if a vault exists and how to create a new one.

```typescript
let vault1_addr = await jVault_holder.VaultAPI.getAddress(config_holder.EOA, 1);
    let code = await config_holder.ethersProvider.getCode(vault1_addr);
    if (code == '0x') {
        console.log('Creating vaults:' + vault1_addr + ' ' + 1);
        vault1_addr = await jVault_holder.VaultAPI.createAccount(config_holder.EOA, 1, {
            maxFeePerGas: feeData.lastBaseFeePerGas,
            maxPriorityFeePerGas: ethers.utils.parseEther('0.0001')
        });
    }
    return vault1_addr;
```

## Execute Your First Transaction

Let's create your first transaction

```typescript
 let tx = await jVault_holder.OptionTradingAPI.InitializeVaultAndplaceOrder({
                amount: ethers.utils.parseEther('100'),
                underlyingAsset: ADDRESSES.arbitrum.ARB,
                optionType: OptionType.CALL,
                premiumAsset: ADDRESSES.arbitrum.USDT,
                optionVault: optionVault,
                optionWriter: writer_config.arbitrum.CALL.ARB,
                premiumVault: vaults_1,
                chainId: config.chainId,
                secondsToExpiry: 3600 * 2
            }, {
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
            });
 if (tx) {
                console.log(`order TX: ${tx.hash}`);
                await tx.wait(1);
                let order = await jVault_holder.OptionTradingAPI.getOrderByHash(tx.hash);
                console.log(order);
            }
```

This example shows how to create a call option order with a size of 100 ARB on Arbitrum.

## Get Order Details

After executing a transaction, you may want to retrieve the details of the order. You can do this easily with the following code:

```typescript
 let order = await jVault_holder.OptionTradingAPI.getOrderByHash(tx.hash);
 console.log(order);

```
