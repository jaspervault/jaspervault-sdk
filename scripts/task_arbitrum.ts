import { JVault } from '../src';
import { JVaultConfig, OptionType, NetworkConfig, JVaultOrder } from '../src/utils/types/index';
import { transformWriterSettings } from '../src/utils';
import { ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
import ParticalHandler from '../src/utils/ParticalHandler';
import AlchemyBundlerHandler from '../src/utils/AlchemyBundlerHandler';
import { particalConfig } from './config/partical_config';
import { alchemyConfig } from './config/alchemy_config';

// Task configuration - you can simply switch tasks to execute here
const TASK_CONFIG = {
    enableQuery: true,          // Query seller configuration
    enableBatchOrders: false,   // Batch orders
    enableCallTest: false,      // CALL option test
    enablePutTest: false,       // PUT option test
    enableEventListeners: false // Event listeners
};

let config_holder: JVaultConfig;
// let config_writer: JVaultConfig;
let jVault_holder: JVault;
dotenv.config();
let feeData: FeeData;
let network_config: NetworkConfig = JVault.readNetworkConfig("arbitrum");

async function queryWriterSettings() {
    try {
        console.log('Querying writer settings...');

        // Specify the vault address to query
        const vault_addr = '0x8126eC6d7805df102724afe22A38376Dc42F7902';
        console.log(`Querying vault address: ${vault_addr}`);

        try {
            // Query contract configuration using vault address
            let vaultWriterConfig = await jVault_holder.VaultAPI.getOptionWriterSettings(vault_addr);

            if (vaultWriterConfig && vaultWriterConfig.length > 0) {
                console.log('\n=== Writer Configuration Details ===');
                console.log(`Found ${vaultWriterConfig.length} configuration items\n`);

                const formattedSettings = formatManagedOptionsSettings(vaultWriterConfig);
                formattedSettings.forEach(setting => {
                    console.log(JSON.stringify(setting, null, 2));
                    console.log('─'.repeat(80));
                });
            } else {
                console.log('No writer configuration found for this vault');
            }
        } catch (error: any) {
            console.log(`Failed to query vault ${vault_addr} configuration:`, error.message);
        }


    } catch (error: any) {
        console.error('Failed to query writer configuration:', error);
    }
}

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

    let alchemyHandler: AlchemyBundlerHandler = new AlchemyBundlerHandler({
        chainId: network_config.chainId,
        apiKey: alchemyConfig.apiKey,
        gasManagerPolicyId: alchemyConfig.gasManagerPolicyId,
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        data: {
            contractData: {
                EntryPoint: network_config.contractData.EntryPoint,
                VaultFactory: network_config.contractData.VaultFactory
            }
        }
    });

    particalHandler;

    let maxFeePerGas = feeData.lastBaseFeePerGas.mul(120).div(100).add(ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"))

    config_holder = {
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        network: network_config.name,
        EOA: ethersSigner.address,
        transactionHandler: alchemyHandler,
        gasSettings: {
            maxFeePerGas: feeData == undefined ? ethers.utils.parseUnits(network_config.defaultFeeData.maxFeePerGas, "gwei") : maxFeePerGas,
            maxPriorityFeePerGas: ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"),
        }
    }; console.log(config_holder.gasSettings)
    jVault_holder = new JVault(config_holder);

    // Option 1: Use command line parameters for control (recommended)
    const task = process.argv[2];

    if (task) {
        // Select task to execute based on command line parameters
        switch (task) {
            case 'query':
                console.log('🔍 Executing query task...');
                await queryWriterSettings();
                break;
            case 'batch':
                console.log('📦 Executing batch orders task...');
                await sendDegenBatchOrders();
                break;
            case 'call':
                console.log('📞 Executing CALL option test...');
                await optionHolder_test(OptionType.CALL);
                break;
            case 'put':
                console.log('📝 Executing PUT option test...');
                await optionHolder_test(OptionType.PUT);
                break;
            case 'all':
                console.log('🚀 Executing all tasks...');
                await executeAllTasks();
                break;
            default:
                console.log('❌ Unknown task. Available tasks:');
                console.log('  - query: Query writer settings');
                console.log('  - batch: Send degen batch orders');
                console.log('  - call: Test CALL options');
                console.log('  - put: Test PUT options');
                console.log('  - all: Execute all tasks');
                console.log('');
                console.log('Usage examples:');
                console.log('  npx ts-node scripts/task_arbitrum.ts query');
                console.log('  npx ts-node scripts/task_arbitrum.ts batch');
                console.log('  npx ts-node scripts/task_arbitrum.ts all');
                break;
        }
    } else {
        // Option 2: Use configuration object for control (alternative)
        console.log('🔧 Using TASK_CONFIG to control execution...');

        if (TASK_CONFIG.enableQuery) {
            console.log('🔍 Executing query task...');
            await queryWriterSettings();
        }

        if (TASK_CONFIG.enableEventListeners) {
            const eventEmitter = jVault_holder.OptionTradingAPI.getEventEmitter();
            eventEmitter.on('beforeApprove', (data) => {
                console.log("beforeApprove", data);
            });
        }

        if (TASK_CONFIG.enableBatchOrders) {
            console.log('📦 Executing batch orders task...');
            await sendDegenBatchOrders();
        }

        if (TASK_CONFIG.enableCallTest) {
            console.log('📞 Executing CALL option test...');
            await optionHolder_test(OptionType.CALL);
        }

        if (TASK_CONFIG.enablePutTest) {
            console.log('📝 Executing PUT option test...');
            await optionHolder_test(OptionType.PUT);
        }
    }
}

async function executeAllTasks() {
    const eventEmitter = jVault_holder.OptionTradingAPI.getEventEmitter();
    eventEmitter.on('beforeApprove', (data) => {
        console.log("beforeApprove", data);
    });
    await queryWriterSettings();
    await sendDegenBatchOrders();
    await optionHolder_test(OptionType.CALL);
    await optionHolder_test(OptionType.PUT);
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

    let writer_settings_from_api = await jVault_holder.OptionTradingAPI.getOptionWriterSettingsFromAPI('arbitrum');
    let writer_config = transformWriterSettings(writer_settings_from_api, 'arbitrum');
    console.log(writer_config);
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
    txs.push({
        amount: ethers.utils.parseEther('0.001'),
        underlyingAsset: ADDRESSES.arbitrum.WBTC,
        optionType: OptionType.CALL,
        premiumAsset: ADDRESSES.arbitrum.USDT,
        optionVault: ethers.constants.AddressZero,
        optionWriter: writer_config.arbitrum.CALL.WBTC,
        premiumVault: vaults_1,
        chainId: network_config.chainId,
        secondsToExpiry: 3600 * 0.5
    });
    txs.push({
        amount: ethers.utils.parseEther('0.001'),
        underlyingAsset: ADDRESSES.arbitrum.WBTC,
        optionType: OptionType.PUT,
        premiumAsset: ADDRESSES.arbitrum.USDT,
        optionVault: ethers.constants.AddressZero,
        optionWriter: writer_config.arbitrum.PUT.WBTC,
        premiumVault: vaults_1,
        chainId: network_config.chainId,
        secondsToExpiry: 3600 * 0.5
    });
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
        console.error(`submit order failed: ${error}`);
    }
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
    let writer_settings_from_api = await jVault_holder.OptionTradingAPI.getOptionWriterSettingsFromAPI('arbitrum');
    let writer_config = transformWriterSettings(writer_settings_from_api, 'arbitrum');
    let vaults = await jVault_holder.VaultAPI.getWalletToVault(signer_Holder);
    console.log(`vaults.length: ${vaults.length}`);
    let vaults_0 = await jVault_holder.VaultAPI.getAddress(signer_Holder, 1);


    // await jVault_holder.VaultAPI.transfer(
    //     jVault_holder.EOA,
    //     vaults_1,
    //     [ADDRESSES.arbitrum.ETH],
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
            let tx = await jVault_holder.OptionTradingAPI.createDegenOrder({
                amount: ethers.utils.parseEther('0.01'),
                underlyingAsset: ADDRESSES.arbitrum.WBTC,
                optionType: OptionType.CALL,
                premiumAsset: ADDRESSES.arbitrum.USDT,
                optionVault: ethers.constants.AddressZero,
                optionWriter: writer_config.arbitrum.CALL.WBTC,
                premiumVault: vaults_1,
                chainId: network_config.chainId,
                secondsToExpiry: 3600 * 1
            }, {
                // maxFeePerGas: feeData.lastBaseFeePerGas?.mul(150).div(100)?.add(ethers.utils.parseUnits('0.01', 'gwei')),
                // maxPriorityFeePerGas: ethers.utils.parseUnits('0.01', 'gwei'),
                //gasLimit: 2000000
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
            let tx = await jVault_holder.OptionTradingAPI.createDegenOrder({
                amount: ethers.utils.parseEther('0.022'),
                underlyingAsset: config_holder.data.eth,
                optionType: OptionType.PUT,
                premiumAsset: ADDRESSES.arbitrum.USDT,
                optionVault: ethers.constants.AddressZero,
                optionWriter: writer_config.arbitrum.PUT.ETH,
                premiumVault: vaults_1,
                chainId: network_config.chainId,
                secondsToExpiry: 7200
            }, {
                // maxFeePerGas: feeData.lastBaseFeePerGas?.add(ethers.utils.parseUnits('0.001', 'gwei')),
                // maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
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

function formatManagedOptionsSettings(settings: any[]) {
    return settings.map((setting, index) => {
        return {
            [`Setting ${index + 1}`]: {
                'Basic Info': {
                    'isOpen': setting.isOpen,
                    'orderType': setting.orderType === 0 ? 'CALL' : setting.orderType === 1 ? 'PUT' : `Unknown(${setting.orderType})`,
                    'writer': setting.writer,
                    'offerID': setting.offerID.toString()
                },
                'Asset Configuration': {
                    'lockAsset': setting.lockAsset,
                    'lockAssetType': setting.lockAssetType,
                    'underlyingAsset': setting.underlyingAsset,
                    'underlyingNftID': setting.underlyingNftID.toString(),
                    'strikeAsset': setting.strikeAsset,
                    'premiumAssets': setting.premiumAssets
                },
                'Amount Limits': {
                    'maximum': setting.maximum.toString(),
                    'maxUnderlyingAssetAmount': setting.maxUnderlyingAssetAmount.toString(),
                    'minUnderlyingAssetAmount': setting.minUnderlyingAssetAmount.toString(),
                    'minQuantity': setting.minQuantity.toString()
                },
                'Product & Rates': {
                    'productTypes': setting.productTypes.map((pt: any) => pt.toString()),
                    'premiumRates': setting.premiumRates.map((pr: any) => pr.toString()),
                    'premiumFloorAMMs': setting.premiumFloorAMMs.map((pf: any) => pf.toString()),
                    'premiumOracleType': setting.premiumOracleType
                },
                'Other Settings': {
                    'liquidateMode': setting.liquidateMode
                }
            }
        };
    });
}

main().catch(error => {
    console.error(error);
    // process.exitCode = 1;
});
