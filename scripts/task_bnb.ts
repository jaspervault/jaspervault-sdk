import { JVault } from '../src';
import { JVaultConfig, OptionType, NetworkConfig } from '../src/utils/types/index';
import { ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
import config from '../src/api/config/bnb.json';
import ParticalHandler from '../src/utils/ParticalHandler';
let config_holder: JVaultConfig;
// let config_writer: JVaultConfig;
let jVault_holder: JVault;
dotenv.config();
let feeData: FeeData;



async function main() {
    let network_config: NetworkConfig = JVault.readNetworkConfig("bnb");
    let ethersProvider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    let ethersSigner = new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER, new ethers.providers.JsonRpcProvider(config.rpcUrl));
    ParticalHandler;

    config_holder = {
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        network: network_config.name,
        EOA: ethersSigner.address,
        // transactionHandler: new ParticalHandler({
        //     chainId: network_config.chainId,
        //     ethersProvider: ethersProvider,
        //     ethersSigner: ethersSigner,
        //     data: {
        //         contractData: {
        //             EntryPoint: network_config.contractData.EntryPoint,
        //             VaultFactory: network_config.contractData.VaultFactory
        //         }
        //     }
        // })
    };

    jVault_holder = new JVault(config_holder);


    feeData = await ethersProvider.getFeeData();
    feeData;
    //  await optionHolder_test(OptionType.CALL);
    await optionHolder_test(OptionType.PUT);
}

async function optionHolder_test(orderType: OptionType = OptionType.CALL) {
    let signer_Holder = await config_holder.ethersSigner.getAddress();
    console.log('Holder Signer:' + signer_Holder);
    let writer_config = await jVault_holder.OptionTradingAPI.getOptionWriterSettingsFromAPI();
    let vaults = await jVault_holder.VaultAPI.getWalletToVault(signer_Holder);
    console.log(`vaults.length: ${vaults.length}`);
    let vaults_1 = await jVault_holder.VaultAPI.getAddress(signer_Holder, 1);
    console.log(`vaults_1: ${vaults_1}`);
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
    // await jVault_holder.VaultAPI.initVault(vaults_1, 1, {
    //     maxFeePerGas: feeData.maxFeePerGas,
    //     maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
    // });
    console.log(`blocknumber: ${await config_holder.ethersProvider.getBlockNumber()}`);
    console.log(`Starting place ${orderType == 0 ? "CALL" : "PUT"} order`);
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
                maxFeePerGas: ethers.utils.parseUnits('0.01', 'gwei'),
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
                premiumAsset: ADDRESSES.bsc.BUSD,
                optionVault: ethers.constants.AddressZero,
                optionWriter: writer_config.base.PUT.ETH,
                premiumVault: vaults_1,
                chainId: config.chainId,
                secondsToExpiry: 7200
            }, {
                maxFeePerGas: ethers.utils.parseUnits('3', 'gwei'),
                maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei'),
                //gasLimit: 2000000
            });
            if (tx) {
                console.log(`order TX: ${tx}`);
                //  await tx.wait();


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
