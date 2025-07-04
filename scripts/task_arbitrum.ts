import { JVault } from '../src';
import { JVaultConfig, OptionType, NetworkConfig, JVaultOrder } from '../src/utils/types/index';
import { ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
import config from '../src/api/config/arbitrum.json';
import ParticalHandler from '../src/utils/ParticalHandler';
import { particalConfig } from './config/partical_config';
import logger from '../src/utils/j_logger';

let config_holder: JVaultConfig;
// let config_writer: JVaultConfig;

dotenv.config();
let feeData: FeeData;


let jVault_holder;


async function main() {
    let network_config: NetworkConfig = JVault.readNetworkConfig("arbitrum");
    let ethersProvider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    let ethersSigner = new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER, new ethers.providers.JsonRpcProvider(config.rpcUrl));
    let particalHandler: ParticalHandler = new ParticalHandler({
        chainId: network_config.chainId,
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        minConfirmationCount: 2,
        data: {
            projectUuid: particalConfig.projectUuid,
            projectKey: particalConfig.projectKey,
            paymasterUrl: particalConfig.paymasterUrl,
            bundlerUrl: particalConfig.bundlerUrl,
            contractData: {
                EntryPoint: network_config.contractData.EntryPoint,
                VaultFactory: network_config.contractData.VaultFactory
            }
        }
    });
    particalHandler;
    feeData = await ethersProvider.getFeeData();
    if (!feeData.lastBaseFeePerGas) {
        throw new Error("lastBaseFeePerGas required");
    }
    let maxFeePerGas = feeData.lastBaseFeePerGas.add(ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"))

    config_holder = {
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        network: network_config.name,
        EOA: ethersSigner.address,
        transactionHandler: particalHandler,
        gasSettings: {
            maxFeePerGas: feeData == undefined ? ethers.utils.parseUnits(network_config.defaultFeeData.maxFeePerGas, "gwei") : maxFeePerGas,
            maxPriorityFeePerGas: ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"),

        }
    };

    jVault_holder = new JVault(config_holder);

    feeData = await ethersProvider.getFeeData();
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
    // let lpvault_setting = await jVault_holder.VaultAPI.getOptionWriterSettings("0x8126eC6d7805df102724afe22A38376Dc42F7902");
    // console.log(lpvault_setting);

    // let writer_config = await jVault_holder.OptionTradingAPI.getOptionWriterSettingsFromAPI();
    let txs: JVaultOrder[] = [];
    txs.push({
        amount: ethers.utils.parseEther('0.01'),
        underlyingAsset: ADDRESSES.arbitrum.WBTC,
        optionType: OptionType.CALL,
        premiumAsset: ADDRESSES.arbitrum.WBTC,
        optionVault: ethers.constants.AddressZero,
        // optionWriter: writer_config.arbitrum.CALL.WBTC,
        optionWriter: "0x8126eC6d7805df102724afe22A38376Dc42F7902",
        premiumVault: vaults_1,
        chainId: config.chainId,
        secondsToExpiry: 3600 * 0.5,
        moduleVersion: 'V4'
    });
    try {
        let tx = await jVault_holder.OptionTradingAPI.createDegenBatchOrders(txs, {
            maxFeePerGas: feeData.lastBaseFeePerGas?.add(ethers.utils.parseUnits('0.01', 'gwei')),
            maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei'),
            // gasLimit: 5000000
        });
        if (tx) {
            let order = await jVault_holder.OptionTradingAPI.getOrderByHash(tx);
            logger.info(order);
        }
    }
    catch (error) {
        console.error(`call order failed: ${error}`);
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
    return
    let signer_Holder = await config_holder.ethersSigner.getAddress();
    console.log('Holder Signer:' + signer_Holder);
    let writer_config = await jVault_holder.OptionTradingAPI.getOptionWriterSettingsFromAPI();
    let vaults = await jVault_holder.VaultAPI.getWalletToVault(signer_Holder);


    console.log(`vaults.length: ${vaults.length}`);
    let vaults_1 = await jVault_holder.VaultAPI.getAddress(signer_Holder, 1);

    //await jVault_holder.VaultAPI.transfer(await config_holder.ethersSigner.getAddress(), vaults_holder[1], ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'], [ethers.utils.parseUnits('10', 6)]);

    console.log(`vaults_1: ${vaults_1}`);
    console.log(`Starting place ${orderType == 0 ? "CALL" : "PUT"} order`);

    if (orderType == OptionType.CALL) {
        try {
            let tx = await jVault_holder.OptionTradingAPI.createOrder({
                amount: ethers.utils.parseEther('100'),
                underlyingAsset: ADDRESSES.arbitrum.ARB,
                optionType: OptionType.CALL,
                premiumAsset: ADDRESSES.arbitrum.USDT,
                optionVault: ethers.constants.AddressZero,
                optionWriter: writer_config.arbitrum.CALL.ARB,
                premiumVault: vaults_1,
                chainId: config.chainId,
                secondsToExpiry: 3600 * 2
            }, {
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
            });
            if (tx) {
                console.log(`order TX: ${tx}`);
                let order = await jVault_holder.OptionTradingAPI.getOrderByHash(tx);
                console.log(order);
            }
        }
        catch (error) {
            console.error(`call order failed: ${error}`);
        }

    }
    else {

        try {
            let tx = await jVault_holder.OptionTradingAPI.createOrder({
                amount: ethers.utils.parseEther('0.0001'),
                underlyingAsset: config_holder.data.eth,
                optionType: OptionType.PUT,
                premiumAsset: ADDRESSES.arbitrum.USDT,
                optionVault: ethers.constants.AddressZero,
                optionWriter: writer_config.arbitrum.PUT.ETH,
                premiumVault: vaults_1,
                chainId: config.chainId,
                secondsToExpiry: 7200
            }, {
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
            });
            if (tx) {
                console.log(`order TX: ${tx}`);
                let order = await jVault_holder.OptionTradingAPI.getOrderByHash(tx);
                console.log(order);
            }
        }
        catch (error) {
            console.error(`put order failed: ${error}`);
        }

    }
}

main().catch(error => {
    console.error(error);
    // process.exitCode = 1;
});
