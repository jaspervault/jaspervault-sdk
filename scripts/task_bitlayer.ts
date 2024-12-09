import { JVault } from '../src';
import { JVaultConfig, OptionType, NetworkConfig, JVaultOrder } from '../src/utils/types/index';
import { BigNumber, ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
import ParticalHandler from '../src/utils/ParticalHandler';
import { particalConfig } from './config/partical_config';
let config_holder: JVaultConfig;
// let config_writer: JVaultConfig;
let jVault_holder: JVault;
dotenv.config();
let feeData: FeeData;
let network_config: NetworkConfig = JVault.readNetworkConfig("bitlayer");



async function main() {
    if (!process.env.PRIVATE_KEY_HOLDER) {
        throw new Error("PRIVATE_KEY_HOLDER is not defined in the environment variables");
    }
    let ethersProvider = new ethers.providers.JsonRpcProvider(network_config.rpcUrl);
    let ethersSigner = new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER, new ethers.providers.JsonRpcProvider(network_config.rpcUrl));
    feeData = await ethersProvider.getFeeData();
    if (!feeData.lastBaseFeePerGas) {
        throw new Error("lastBaseFeePerGas required");
    }
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

    await sendDegenBatchOrders();
}
async function sendDegenBatchOrders() {
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
    console.log(`blocknumber: ${await config_holder.ethersProvider.getBlockNumber()}`);
    console.log(`Starting place CALL order`);
    let feeData = await config_holder.ethersProvider.getFeeData();
    console.log("feeData:", feeData.lastBaseFeePerGas?.toString());
    let vaults_1 = await jVault_holder.VaultAPI.initNewAccount();
    console.log(`vaults_0 ${vaults_0}`, ` vaults_1: ${vaults_1}`);
    let txs: JVaultOrder[] = [];
    BigNumber;
    txs.push({
        amount: ethers.utils.parseEther('0.01'),
        underlyingAsset: ADDRESSES.bitlayer.BTC,
        optionType: OptionType.CALL,
        premiumAsset: ADDRESSES.bitlayer.USDT,
        optionVault: ethers.constants.AddressZero,
        optionWriter: writer_config.bitlayer.CALL.BTC,
        premiumVault: vaults_1,
        chainId: network_config.chainId,
        secondsToExpiry: 3600 * 0.5,
    });
    // txs.push({
    //     amount: ethers.utils.parseEther('0.01'),
    //     underlyingAsset: ADDRESSES.bitlayer.BTC,
    //     optionType: OptionType.PUT,
    //     premiumAsset: ADDRESSES.bitlayer.BTC,
    //     optionVault: ethers.constants.AddressZero,
    //     optionWriter: writer_config.bitlayer.PUT.BTC,
    //     premiumVault: vaults_1,
    //     chainId: network_config.chainId,
    //     secondsToExpiry: 3600 * 0.5,
    //     nftWaiver: network_config.nftWaiver.JSBT,
    //     nftId: BigNumber.from(2)
    // });

    try {
        let tx = await jVault_holder.OptionTradingAPI.createDegenBatchOrders(txs, {
            // maxFeePerGas: feeData.lastBaseFeePerGas?.mul(150).div(100)?.add(ethers.utils.parseUnits('0.01', 'gwei')),
            // maxPriorityFeePerGas: ethers.utils.parseUnits('0.01', 'gwei'),
            //gasLimit: 2000000
        });
        if (tx) {
            let order = await jVault_holder.OptionTradingAPI.getOrderByHash(tx);
            console.log(order);
        }
    }
    catch (error) {
        console.error(`createDegenBatchOrders: ${error}`);
    }
}

main().catch(error => {
    console.error(error);
    // process.exitCode = 1;
});
