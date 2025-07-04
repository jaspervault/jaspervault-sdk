import { JVault } from '../src';
import { JVaultConfig, OptionType, NetworkConfig, JVaultOrder } from '../src/utils/types/index';
import { ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
import ParticalHandler from '../src/utils/ParticalHandler';
import CoinbaseHandler from '../src/utils/CoinbaseHandler';
import { particalConfig } from './config/partical_config';
import { coinbaseConfig } from './config/coinbase_config';
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
    feeData = await ethersProvider.getFeeData();
    if (!feeData.lastBaseFeePerGas) {
        throw new Error("lastBaseFeePerGas required");
    }
    let ethersSigner = new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER, new ethers.providers.JsonRpcProvider(network_config.rpcUrl));
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

    console.log("xxl 00001 base uat particalConfig",particalConfig);

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
    let maxFeePerGas = feeData.lastBaseFeePerGas.add(ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"))

    config_holder = {
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        network: network_config.name,
        EOA: ethersSigner.address,
        // transactionHandler: coinbaseHandler,
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
    // eventEmitter.on('afterSubmitToBundler', (data) => {
    //     //console.log("afterSubmitToBundler", data);
    // });

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



    // 获取当前时间戳（秒）
    let timestamp = Math.floor(Date.now() / 1000);
    console.log('时间戳:', timestamp);
    console.log('对应的时间:', new Date(timestamp * 1000).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }));
    
    // 调用接口获取签名
    const signerAddress = await config_holder.ethersSigner.getAddress();
    const response = await fetch('https://worker-mini-test.fly.dev/api/v2/vaults/getTimeStoneSignature', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            timestamp: timestamp,
            address: signerAddress,
            nftId: 38
        })
    });

    console.log('xxl 00013 response:', response);
    
    const result = await response.json();
    console.log('xxl 00013 result:', result);
    if (result.code !== 200) {
        throw new Error(`Failed to get signature: ${result.message}`);
    }
    
    let signature = result.data.signature;
    console.log('获取到的签名:', signature);


    txs.push({
        amount: ethers.utils.parseEther('0.01'),
        underlyingAsset: ADDRESSES.base.CBBTC,
        optionType: OptionType.CALL,
        premiumAsset: ADDRESSES.base.CBBTC,
        optionVault: ethers.constants.AddressZero,
        optionWriter: writer_config.base_uat.CALL.CBBTC,
        premiumVault: vaults_1,
        chainId: network_config.chainId,
        secondsToExpiry: 3600 * 2,
        timestamp,
        signature,
        unlockTimeSpan: 3600 * 2 - 30
    });
    // txs.push({
    //     amount: ethers.utils.parseEther('0.005'),
    //     underlyingAsset: ADDRESSES.base.ETH,
    //     optionType: OptionType.PUT,
    //     premiumAsset: ADDRESSES.base.USDC,
    //     optionVault: ethers.constants.AddressZero,
    //     optionWriter: writer_config.base_uat.PUT.ETH,
    //     premiumVault: vaults_1,
    //     chainId: network_config.chainId,
    //     secondsToExpiry: 3600 * 2
    // });
    try {
        console.log("xxl 00014 txs",txs);
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
        console.error(`submit order failed: ${error}`);
    }
}

// async function optionHolder_test(orderType: OptionType = OptionType.CALL) {
//     if (!config_holder.ethersSigner) {
//         return console.log("signer_Holder miss")
//     }
//     if (!config_holder.ethersProvider || !config_holder.data) {
//         return console.log("config_holder provier or data miss")
//     }
//     let signer_Holder = await config_holder.ethersSigner.getAddress();
//     console.log('Holder Signer:' + signer_Holder);
//     let writer_config = await jVault_holder.OptionTradingAPI.getOptionWriterSettings();
//     let vaults = await jVault_holder.VaultAPI.getWalletToVault(signer_Holder);
//     console.log(`vaults.length: ${vaults.length}`);
//     let vaults_0 = await jVault_holder.VaultAPI.getAddress(signer_Holder, 1);



//     console.log(`blocknumber: ${await config_holder.ethersProvider.getBlockNumber()}`);
//     console.log(`Starting place ${orderType == 0 ? "CALL" : "PUT"} order`);
//     let feeData = await config_holder.ethersProvider.getFeeData();
//     console.log("feeData:", feeData.lastBaseFeePerGas?.toString());
//     let vaults_1 = await jVault_holder.VaultAPI.initNewAccount();
//     console.log(`vaults_0 ${vaults_0}`, ` vaults_1: ${vaults_1}`);

//     // 获取当前时间戳（秒）
//     let timestamp = Math.floor(Date.now() / 1000);
//     console.log('时间戳:', timestamp);
//     console.log('对应的时间:', new Date(timestamp * 1000).toLocaleString('zh-CN', {
//         timeZone: 'Asia/Shanghai',
//         year: 'numeric',
//         month: '2-digit',
//         day: '2-digit',
//         hour: '2-digit',
//         minute: '2-digit',
//         second: '2-digit',
//         hour12: false
//     }));
    
//     // 调用接口获取签名
//     const signerAddress = await config_holder.ethersSigner.getAddress();
//     const response = await fetch('https://worker-mini-test.fly.dev/api/v2/vaults/getTimeStoneSignature', {
//         method: 'POST',
//         headers: {
//             'accept': 'application/json',
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//             timestamp: timestamp,
//             address: signerAddress,
//             nftId: 11
//         })
//     });


//     console.log('xxl 00013 response:', response);
    
//     const result = await response.json();
//     console.log('xxl 00013 result:', result);
//     if (result.code !== 200) {
//         throw new Error(`Failed to get signature: ${result.message}`);
//     }
    
//     let signature = result.data.signature;


//     if (orderType == OptionType.CALL) {
//         try {
//             let tx = await jVault_holder.OptionTradingAPI.createDegenOrder({
//                 amount: ethers.utils.parseEther('0.0001'),
//                 underlyingAsset: ADDRESSES.base.CBBTC,
//                 optionType: OptionType.CALL,
//                 premiumAsset: ADDRESSES.base.CBBTC,
//                 optionVault: ethers.constants.AddressZero,
//                 optionWriter: writer_config.base.CALL.CBBTC,
//                 premiumVault: vaults_1,
//                 chainId: network_config.chainId,
//                 secondsToExpiry: 1800,
//                 timestamp,
//                 signature,
//                 unlockTimeSpan: 1730
//             }, {
//                 // maxFeePerGas: feeData.lastBaseFeePerGas?.mul(150).div(100)?.add(ethers.utils.parseUnits('0.01', 'gwei')),
//                 // maxPriorityFeePerGas: ethers.utils.parseUnits('0.01', 'gwei'),
//                 //gasLimit: 2000000
//             });
//             if (tx) {
//                 // console.log(`order TX: ${tx.hash}`);
//                 // await tx.wait();
//                 let order = await jVault_holder.OptionTradingAPI.getOrderByHash(tx);
//                 console.log(order);
//             }
//         }
//         catch (error) {
//             console.error(`call order failed: ${error}`);
//         }
//     }
//     else {
//         try {
//             let tx = await jVault_holder.OptionTradingAPI.createDegenOrder({
//                 amount: ethers.utils.parseEther('0.022'),
//                 underlyingAsset: config_holder.data.eth,
//                 optionType: OptionType.PUT,
//                 premiumAsset: ADDRESSES.base.USDC,
//                 optionVault: ethers.constants.AddressZero,
//                 optionWriter: writer_config.base.PUT.ETH,
//                 premiumVault: vaults_1,
//                 chainId: network_config.chainId,
//                 secondsToExpiry: 1800,
//                 timestamp,
//                 signature,
//                 unlockTimeSpan: 1730
//             }, {
//                 // maxFeePerGas: feeData.lastBaseFeePerGas?.add(ethers.utils.parseUnits('0.001', 'gwei')),
//                 // maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
//                 //gasLimit: 2000000
//             });
//             if (tx) {
//                 console.log(`order TX: ${tx}`);
//                 let order = await jVault_holder.OptionTradingAPI.getOrderByHash(tx);
//                 console.log(order);
//             }
//         }
//         catch (error) {
//             console.error(`put order failed: ${error}`);
//         }

//     }
// }

main().catch(error => {
    console.error(error);
    // process.exitCode = 1;
});
