import { JVault } from '../src';
import { JVaultConfig, OptionType, NetworkConfig } from '../src/utils/types/index';
import { ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
import config from '../src/api/config/base.json';
import ParticalHandler from '../src/utils/ParticalHandler';
import CoinbaseHandler from '../src/utils/CoinbaseHandler';
import { particalConfig } from './config/partical_config';
import { coinbaseConfig } from './config/coinbase_config';
let config_holder: JVaultConfig;
// let config_writer: JVaultConfig;
let jVault_holder: JVault;
dotenv.config();
let feeData: FeeData;



async function main() {
    let network_config: NetworkConfig = JVault.readNetworkConfig("base");
    let ethersProvider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    let ethersSigner = new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER, new ethers.providers.JsonRpcProvider(config.rpcUrl));
    let particalHandler: ParticalHandler = new ParticalHandler({
        chainId: network_config.chainId,
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
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
    let coinbaseHandler = new CoinbaseHandler({
        chainId: network_config.chainId,
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        bundlerUrl: coinbaseConfig.bundlerUrl,
        data: {
            contractData: {
                EntryPoint: network_config.contractData.EntryPoint,
                VaultFactory: network_config.contractData.VaultFactory
            }
        }
    });
    particalHandler;
    coinbaseHandler;
    config_holder = {
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        network: network_config.name,
        EOA: ethersSigner.address,
        transactionHandler: coinbaseHandler
    };

    jVault_holder = new JVault(config_holder);


    feeData = await ethersProvider.getFeeData();
    feeData;
    await optionHolder_test(OptionType.CALL);
    //await optionHolder_test(OptionType.PUT);
}

async function optionHolder_test(orderType: OptionType = OptionType.CALL) {
    if (!config_holder.ethersSigner) {
        return console.log("signer_Holder miss")
    }
    if (!config_holder.ethersProvider || !config_holder.data) {
        return console.log("config_holder provier or data miss")
    }
    let signer_Holder = await config_holder.ethersSigner.getAddress();
    console.log('Holder Signer:' + signer_Holder);
    let writer_config = await jVault_holder.OptionTradingAPI.getOptionWriterSettings();
    let vaults = await jVault_holder.VaultAPI.getWalletToVault(signer_Holder);
    console.log(`vaults.length: ${vaults.length}`);
    let vaults_0 = await jVault_holder.VaultAPI.getAddress(signer_Holder, 1);


    // await jVault_holder.VaultAPI.transfer(
    //     jVault_holder.EOA,
    //     vaults_1,
    //     [ADDRESSES.base.ETH],
    //     [ethers.utils.parseUnits('0.001', 18)],
    //     {
    //         value: ethers.utils.parseUnits('0.001', 18),
    //         maxFeePerGas: ethers.utils.parseUnits('0.01', 'gwei'),
    //         maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
    //     });
    // return

    console.log(`blocknumber: ${await config_holder.ethersProvider.getBlockNumber()}`);
    console.log(`Starting place ${orderType == 0 ? "CALL" : "PUT"} order`);
    let feeData = await config_holder.ethersProvider.getFeeData();
    console.log("feeData:", feeData.lastBaseFeePerGas?.toString());
    let vaults_1 = await jVault_holder.VaultAPI.initNewAccount();
    console.log(`vaults_0 ${vaults_0}`, ` vaults_1: ${vaults_1}`);
    if (orderType == OptionType.CALL) {
        try {
            let tx = await jVault_holder.OptionTradingAPI.createOrder({
                amount: ethers.utils.parseEther('0.022'),
                underlyingAsset: config_holder.data.eth,
                optionType: OptionType.CALL,
                premiumAsset: ADDRESSES.base.USDC,
                optionVault: ethers.constants.AddressZero,
                optionWriter: writer_config.base.CALL.ETH,
                premiumVault: vaults_1,
                chainId: config.chainId,
                secondsToExpiry: 3600 * 2
            }, {
                maxFeePerGas: feeData.lastBaseFeePerGas?.add(ethers.utils.parseUnits('0.001', 'gwei')),
                maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
            });
            if (tx) {
                // console.log(`order TX: ${tx.hash}`);
                // await tx.wait();
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
                amount: ethers.utils.parseEther('0.022'),
                underlyingAsset: config_holder.data.eth,
                optionType: OptionType.PUT,
                premiumAsset: ADDRESSES.base.USDC,
                optionVault: ethers.constants.AddressZero,
                optionWriter: writer_config.base.PUT.ETH,
                premiumVault: vaults_1,
                chainId: config.chainId,
                secondsToExpiry: 7200
            }, {
                maxFeePerGas: feeData.lastBaseFeePerGas?.add(ethers.utils.parseUnits('0.001', 'gwei')),
                maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
                //gasLimit: 2000000
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
