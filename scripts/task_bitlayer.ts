import { JVault } from '../src';
import { JVaultConfig, OptionType, NetworkConfig, JVaultOrder } from '../src/utils/types/index';
import { BigNumber, ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
import ParticalHandler from '../src/utils/ParticalHandler';
import BitlayerBundlerHandler from '../src/utils/BitlayerBundlerHandler';
import { particalConfig } from './config/partical_config';
import axios from 'axios';
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';
import logger from '../src/utils/j_logger';
import { bitlayerBundlerConfig } from './config/bitlayer_bundler_config';

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
    let maxFeePerGas = feeData.lastBaseFeePerGas.add(ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"))
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

    for (let i = 0; i < 1; i++) {
        await sendDegenBatchOrders();
    }

    return
    let priceIds = [];
    for (let i = 0; i < jVault_holder.config.data.apro.length; i++) {
        priceIds.push(jVault_holder.config.data.apro[i].id);
    }

    const feedIDsParam = priceIds.join(',');
    for (let i = 0; i < 300; i++) {
        try {
            const timestamp = Math.floor(Date.now() / 1000) - 1;
            const response = await axios.get(`${jVault_holder.config.data.aproEndpoint}/api/v1/reports/bulk`, {
                params: {
                    feedIDs: feedIDsParam,
                    timestamp: timestamp,
                },
                headers: {
                    'Authorization': jVault_holder.config.data.aproAuthorization,
                    'X-Authorization-Timestamp': Date.now(),
                },
            });
            const response_latest = await axios.get(`${jVault_holder.config.data.aproEndpoint}/api/v1/reports/latest`, {
                params: {
                    feedID: priceIds[0]
                },
                headers: {
                    'Authorization': jVault_holder.config.data.aproAuthorization,
                    'X-Authorization-Timestamp': Date.now(),
                },
            });
            if (response.data.reports.length == 0) {
                throw new Error('Reports empty! Failed to fetch APRO price feed update data');
            }
            logger.info(Date.now())
            logger.info(`Fetched APRO ${response.data.reports.length} reports`);
            logger.info("APRO_bulk:  " + response.data.reports[0].midPrice);
            logger.info("APRO_latest:" + response_latest.data.report.midPrice);
            const connection = new EvmPriceServiceConnection('https://hermes.pyth.network');
            let pythPrice = await connection.getLatestPriceFeeds(["0x2817d7bfe5c64b8ea956e9a26f573ef64e72e4d7891f2d6af9bcc93f7aff9a97"])
            let pythPriceString = pythPrice[0].getPriceUnchecked().price
            logger.info("PYTH:       " + ethers.utils.formatUnits(pythPriceString, 8));
            logger.info("=====================================")
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second
        }
        catch (error) {
            continue;
        }
    }

    for (let i = 0; i < 1; i++) {
        await sendDegenBatchOrders();
    }
    return

}
async function sendDegenBatchOrders() {
    if (!config_holder.ethersSigner) {
        return logger.info("signer_Holder miss")
    }
    if (!config_holder.ethersProvider || !config_holder.data) {
        return logger.info("config_holder provier or data miss")
    }
    let signer_Holder = await config_holder.ethersSigner.getAddress();
    logger.info('Holder Signer:' + signer_Holder);
    //let writer_config = await jVault_holder.OptionTradingAPI.getOptionWriterSettingsFromAPI();
    let vaults = await jVault_holder.VaultAPI.getWalletToVault(signer_Holder);
    logger.info(`vaults.length: ${vaults.length}`);
    let vaults_0 = await jVault_holder.VaultAPI.getAddress(signer_Holder, 1);
    logger.info(`blocknumber: ${await config_holder.ethersProvider.getBlockNumber()}`);
    logger.info(`Starting place CALL order`);
    let feeData = await config_holder.ethersProvider.getFeeData();
    logger.info("feeData:", feeData.lastBaseFeePerGas?.toString());
    let vaults_1 = await jVault_holder.VaultAPI.initNewAccount();
    logger.info(`vaults_0 ${vaults_0}`, ` vaults_1: ${vaults_1}`);
    let txs: JVaultOrder[] = [];
    BigNumber;
    txs.push({
        amount: ethers.utils.parseEther('0.00001'),
        underlyingAsset: ADDRESSES.bitlayer.BTC,
        optionType: OptionType.CALL,
        premiumAsset: ADDRESSES.bitlayer.BTC,
        optionVault: ethers.constants.AddressZero,
        //  optionWriter: writer_config.bitlayer.CALL.BTC,
        optionWriter: "0xebda884558f79242765b6a3bbb3bce6539528ff8",
        premiumVault: vaults_1,
        chainId: network_config.chainId,
        secondsToExpiry: 3600 * 0.5,
        // nftWaiver: network_config.nftWaiver.JSBT,
        // nftId: BigNumber.from(8)
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
            maxFeePerGas: feeData.lastBaseFeePerGas?.add(ethers.utils.parseUnits('0.051', 'gwei')),
            maxPriorityFeePerGas: ethers.utils.parseUnits('0.05', 'gwei'),
            //gasLimit: 5000000
        });
        if (tx) {
            let order = await jVault_holder.OptionTradingAPI.getOrderByHash(tx);
            logger.info(order);
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
