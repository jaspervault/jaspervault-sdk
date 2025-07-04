import { JVault } from '../src';
import { JVaultConfig, OptionType, NetworkConfig, JVaultOrder } from '../src/utils/types/index';
import { ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
let config_holder: JVaultConfig;
// let config_writer: JVaultConfig;
let jVault_holder: JVault;
dotenv.config();
let feeData: FeeData;
let network_config: NetworkConfig = JVault.readNetworkConfig("base_uat");


async function main() {

    if (!process.env.PRIVATE_KEY_HOLDER) {
        throw new Error("PRIVATE_KEY_HOLDER is not defined in the environment variables");
    }

    console.log('network_config:', network_config);
    let ethersProvider = new ethers.providers.JsonRpcProvider(network_config.rpcUrl);
    feeData = await ethersProvider.getFeeData();
    if (!feeData.lastBaseFeePerGas) {
        throw new Error("lastBaseFeePerGas required");
    }

    let ethersSigner = new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER, new ethers.providers.JsonRpcProvider(network_config.rpcUrl));
    let maxFeePerGas = feeData.lastBaseFeePerGas.add(ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"))

    config_holder = {
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        network: network_config.name,
        EOA: ethersSigner.address,

        gasSettings: {
            maxFeePerGas: feeData == undefined ? ethers.utils.parseUnits(network_config.defaultFeeData.maxFeePerGas, "gwei") : maxFeePerGas,
            maxPriorityFeePerGas: ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"),
        }
    };

    jVault_holder = new JVault(config_holder);
    const eventEmitter = jVault_holder.OptionTradingAPI.getEventEmitter();

    eventEmitter.on('beforeApprove', (data) => {
        console.log("beforeApprove", data);
    });


    await sendDegenBatchOrders();
    return
    // await optionHolder_test(OptionType.CALL);
    //await optionHolder_test(OptionType.PUT);
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
    
    console.log(`Starting place CALL order`);
    let feeData = await config_holder.ethersProvider.getFeeData();
    console.log("feeData:", feeData.lastBaseFeePerGas?.toString());
    let vaults_1 = await jVault_holder.VaultAPI.initNewAccount();
    console.log(`vaults_0 ${vaults_0}`, ` vaults_1: ${vaults_1}`);
    let txs: JVaultOrder[] = [];

    // txs.push({
    //     amount: ethers.utils.parseEther('0.0001'),
    //     underlyingAsset: ADDRESSES.base.CBBTC,
    //     optionType: OptionType.CALL,
    //     premiumAsset: ADDRESSES.base.USDC,
    //     optionVault: ethers.constants.AddressZero,
    //     optionWriter: writer_config.base_uat.CALL.CBBTC,
    //     premiumVault: vaults_1,
    //     chainId: network_config.chainId,
    //     secondsToExpiry: 3600 * 2
    // });
    txs.push({
        amount: ethers.utils.parseEther('0.01'),
        underlyingAsset: ADDRESSES.base.ETH,
        optionType: OptionType.PUT,
        premiumAsset: ADDRESSES.base.USDC,
        optionVault: ethers.constants.AddressZero,
        optionWriter: writer_config.base_uat.PUT.ETH,
        premiumVault: vaults_1,
        chainId: network_config.chainId,
        secondsToExpiry: 1800
    });
    console.log('xxl ---- txs:', txs);

    try {
        let tx = await jVault_holder.OptionTradingAPI.createDegenBatchOrders(txs, {
            maxFeePerGas: feeData.lastBaseFeePerGas?.mul(150).div(100)?.add(ethers.utils.parseUnits('0.01', 'gwei')),
            maxPriorityFeePerGas: ethers.utils.parseUnits('0.01', 'gwei'),
            gasLimit: 8000000
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
