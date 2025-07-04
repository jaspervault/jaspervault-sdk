import { JVault } from '../src';
import { JVaultConfig, OptionType, NetworkConfig, JVaultOrder } from '../src/utils/types/index';
import { BigNumber, ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
import ParticalHandler from '../src/utils/ParticalHandler';
import BitlayerBundlerHandler from '../src/utils/BitlayerBundlerHandler';
import { particalConfig } from './config/partical_config';
import { bitlayerBundlerConfig } from './config/bitlayer_bundler_config';
let config_holder: JVaultConfig;
// let config_writer: JVaultConfig;
let jVault_holder: JVault;
dotenv.config();
let feeData: FeeData;
let network_config: NetworkConfig = JVault.readNetworkConfig("bitlayer_test");



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
    let bitlayerBundlerHandler: BitlayerBundlerHandler = new BitlayerBundlerHandler({
        chainId: network_config.chainId,
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        minConfirmationCount: 2,
        data: {
            projectAPIKey: bitlayerBundlerConfig.projectAPIKey,
            paymasterUrl: bitlayerBundlerConfig.paymasterUrl,
            bundlerUrl: bitlayerBundlerConfig.bundlerUrl,
            contractData: {
                EntryPoint: network_config.contractData.EntryPoint,
                VaultFactory: network_config.contractData.VaultFactory
            }
        }
    });
    bitlayerBundlerHandler;

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
    let maxFeePerGas = feeData.lastBaseFeePerGas.mul(2).add(ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"))

    config_holder = {
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        network: network_config.name,
        EOA: ethersSigner.address,
        transactionHandler: bitlayerBundlerHandler,
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
    let writer_config = await jVault_holder.OptionTradingAPI.getOptionWriterSettingsFromAPI();
    let vaults = await jVault_holder.VaultAPI.getWalletToVault(signer_Holder);
    console.log(`vaults.length: ${vaults.length}`);
    let vaults_0 = await jVault_holder.VaultAPI.getAddress(signer_Holder, 1);
    console.log(`blocknumber: ${await config_holder.ethersProvider.getBlockNumber()}`);
    console.log(`Starting place order`);
    let feeData = await config_holder.ethersProvider.getFeeData();
    console.log("feeData:", feeData.lastBaseFeePerGas?.toString());
    let vaults_1 = await jVault_holder.VaultAPI.initNewAccount();
    console.log(`vaults_0 ${vaults_0}`, ` vaults_1: ${vaults_1}`);
    let txs: JVaultOrder[] = [];
    BigNumber;
    //await jVault_holder.VaultAPI.initNewAccount();

    txs.push({
        amount: ethers.utils.parseEther('0.0001'),
        underlyingAsset: ADDRESSES.bitlayer.BTC,
        optionType: OptionType.CALL,
        premiumAsset: ADDRESSES.bitlayer_test.USDT,
        optionVault: ethers.constants.AddressZero,
        optionWriter: writer_config.bitlayer_test.CALL.BTC,
        premiumVault: vaults_1,
        chainId: network_config.chainId,
        secondsToExpiry: 3600 * 0.5,
    });
    // txs.push({
    //     amount: ethers.utils.parseEther('0.0001'),
    //     underlyingAsset: ADDRESSES.bitlayer.BTC,
    //     optionType: OptionType.PUT,
    //     premiumAsset: ADDRESSES.bitlayer_test.USDT,
    //     optionVault: ethers.constants.AddressZero,
    //     optionWriter: writer_config.bitlayer_test.PUT.BTC,
    //     premiumVault: vaults_1,
    //     chainId: network_config.chainId,
    //     secondsToExpiry: 3600 * 0.5,
    // });
    // txs.push({
    //     amount: ethers.utils.parseEther('0.01'),
    //     underlyingAsset: ADDRESSES.bitlayer.BTC,
    //     optionType: OptionType.CALL,
    //     premiumAsset: ADDRESSES.bitlayer_test.BTC,
    //     optionVault: ethers.constants.AddressZero,
    //     optionWriter: writer_config.bitlayer_test.CALL.BTC,
    //     premiumVault: vaults_1,
    //     chainId: network_config.chainId,
    //     secondsToExpiry: 3600 * 0.5,
    //     nftWaiver: network_config.nftWaiver.JSBT,
    //     nftId: BigNumber.from(4)
    // });
    // txs.push({
    //     amount: ethers.utils.parseEther('0.01'),
    //     underlyingAsset: ADDRESSES.bitlayer.BTC,
    //     optionType: OptionType.PUT,
    //     premiumAsset: ADDRESSES.bitlayer_test.BTC,
    //     optionVault: ethers.constants.AddressZero,
    //     optionWriter: writer_config.bitlayer_test.PUT.BTC,
    //     premiumVault: vaults_1,
    //     chainId: network_config.chainId,
    //     secondsToExpiry: 3600 * 0.5,
    //     nftWaiver: network_config.nftWaiver.JSBT,
    //     nftId: BigNumber.from(2)
    // });

    try {
        let tx = await jVault_holder.OptionTradingAPI.createDegenBatchOrders(txs, {
            maxFeePerGas: feeData.lastBaseFeePerGas?.add(ethers.utils.parseUnits('0.05', 'gwei')),
            maxPriorityFeePerGas: ethers.utils.parseUnits('0.05', 'gwei'),
            //gasLimit: 5000000
        });
        if (tx) {
            let order = await jVault_holder.OptionTradingAPI.getOrderByHash(tx);
            console.log(order);
        }
    }
    catch (error) {
        console.error(`submit order failed: ${error}`);
    }
}

main().catch(error => {
    console.error(error);
    // process.exitCode = 1;
});
