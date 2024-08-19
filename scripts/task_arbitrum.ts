import { JVault } from '../src';
import { JVaultConfig, OptionType } from '../src/utils/types/index';
import { ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
import config from '../src/api/config/arbitrum.json';
let config_holder: JVaultConfig;
// let config_writer: JVaultConfig;

dotenv.config();
let feeData: FeeData;

config_holder = {
    ethersProvider: new ethers.providers.JsonRpcProvider(config.rpcUrl),
    ethersSigner: new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER,
        new ethers.providers.JsonRpcProvider(config.rpcUrl)),
    network: 'arbitrum',
    EOA: new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER,
        new ethers.providers.JsonRpcProvider(config.rpcUrl)).address
};



const jVault_holder = new JVault(config_holder);


async function main() {
    feeData = await config_holder.ethersProvider.getFeeData();
    await quickStart();
    await optionHolder_test(OptionType.CALL);
    // await optionHolder_test(OptionType.PUT);
}

async function quickStart() {
    let signer_Holder = await config_holder.ethersSigner.getAddress();
    console.log('Holder Signer:' + signer_Holder);
    let vaults_1 = await checkVault1isExist();
    console.log(`vaults_1: ${vaults_1}`);
    console.log(`Starting place order`);
    let optionVault = await jVault_holder.VaultAPI.createNewVault(signer_Holder, {
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
    });
    console.log(`optionVault: ${optionVault}`);
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
}

async function checkVault1isExist() {
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
}
async function optionHolder_test(orderType: OptionType = OptionType.CALL) {
    return;
    let signer_Holder = await config_holder.ethersSigner.getAddress();
    console.log('Holder Signer:' + signer_Holder);
    let writer_config = await jVault_holder.OptionTradingAPI.getOptionWriterSettings();
    let vaults = await jVault_holder.VaultAPI.getWalletToVault(signer_Holder);
    if (vaults.length <= 2) {
        for (let i = 0; i < 4; i++) {
            let vault_addr = await jVault_holder.VaultAPI.getAddress(signer_Holder, i);
            let code = await config_holder.ethersProvider.getCode(vault_addr);
            if (code == '0x') {
                console.log('Creating vaults:' + vault_addr + ' ' + i);
                await jVault_holder.VaultAPI.createNewVault(signer_Holder, {
                    maxFeePerGas: feeData.lastBaseFeePerGas,
                    maxPriorityFeePerGas: ethers.utils.parseEther('0.0001')
                });
            }
        }
        vaults = await jVault_holder.VaultAPI.getWalletToVault(signer_Holder);
    }

    console.log(`vaults.length: ${vaults.length}`);
    let vaults_1 = await jVault_holder.VaultAPI.getAddress(signer_Holder, 1);

    //await jVault_holder.VaultAPI.transfer(await config_holder.ethersSigner.getAddress(), vaults_holder[1], ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'], [ethers.utils.parseUnits('10', 6)]);

    console.log(`vaults_1: ${vaults_1}`);
    console.log(`Starting place ${orderType == 0 ? "CALL" : "PUT"} order`);
    let optionVault = await jVault_holder.VaultAPI.createNewVault(signer_Holder, {
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
    });
    console.log(`optionVault: ${optionVault}`);
    if (orderType == OptionType.CALL) {
        if (optionVault != ethers.constants.AddressZero) {
            try {
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
                }
            }
            catch (error) {
                console.error(`call order failed: ${error}`);
            }
        }
    }
    else {
        if (optionVault != ethers.constants.AddressZero) {
            try {
                let tx = await jVault_holder.OptionTradingAPI.InitializeVaultAndplaceOrder({
                    amount: ethers.utils.parseEther('0.0001'),
                    underlyingAsset: config_holder.data.eth,
                    optionType: OptionType.PUT,
                    premiumAsset: ADDRESSES.arbitrum.USDT,
                    optionVault: optionVault,
                    optionWriter: writer_config.arbitrum.PUT.ETH,
                    premiumVault: vaults_1,
                    chainId: config.chainId,
                    secondsToExpiry: 3600 * 2
                });
                if (tx) {
                    console.log(`order TX: ${tx.hash}`);
                }
            }
            catch (error) {
                console.error(`put order failed: ${error}`);
            }
        }
    }
}

main().catch(error => {
    console.error(error);
    // process.exitCode = 1;
});
