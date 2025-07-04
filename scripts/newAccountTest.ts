import { JVault } from '../src';
import { JVaultConfig, NetworkConfig, JVaultOrder, OptionType } from '../src/utils/types/index';
import { ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
import ParticalHandler from '../src/utils/ParticalHandler';
import CoinbaseHandler from '../src/utils/CoinbaseHandler';
import { coinbaseConfig } from './config/coinbase_config';
import { particalConfig } from './config/partical_config';
let config_holder: JVaultConfig;
let config_a1: JVaultConfig;
let jVault_holder: JVault;
let jVault_a1: JVault;

dotenv.config();
let feeData: FeeData;
let network_name = "bitlayer";
let network_config: NetworkConfig = JVault.readNetworkConfig(network_name);
let maxFeePerGas

async function main() {
    let ethersProvider = new ethers.providers.JsonRpcProvider(network_config.rpcUrl);
    if (!process.env.PRIVATE_KEY_HOLDER) {
        throw new Error("PRIVATE_KEY_HOLDER is not defined in the environment variables");
    }

    let ethersSigner = new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER, new ethers.providers.JsonRpcProvider(network_config.rpcUrl));
    let wallet = ethers.Wallet.createRandom();
    const ethersSigner_a1 = wallet.connect(ethersProvider);

    feeData = await ethersProvider.getFeeData();
    if (!feeData.lastBaseFeePerGas) {
        throw new Error("lastBaseFeePerGas required");
    }
    maxFeePerGas = feeData.lastBaseFeePerGas.add(ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"))
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
    let particalHandler_a1: ParticalHandler = new ParticalHandler({
        chainId: network_config.chainId,
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner_a1,
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
    particalHandler_a1
    config_a1 = {
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner_a1,
        network: network_config.name,
        EOA: ethersSigner_a1.address,
        transactionHandler: particalHandler_a1,
        gasSettings: {
            maxFeePerGas: feeData == undefined ? ethers.utils.parseUnits(network_config.defaultFeeData.maxFeePerGas, "gwei") : maxFeePerGas,
            maxPriorityFeePerGas: ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"),
        }
    };
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
    jVault_a1 = new JVault(config_a1);
    jVault_holder = new JVault(config_holder);
    console.log('jVault_a1:', jVault_a1.EOA);
    console.log('jVault_holder:', jVault_holder.EOA);

    let vault_1_a1 = await jVault_a1.VaultAPI.getAddress(jVault_a1.config.EOA, 1);
    console.log(`vault_1_a1: ${vault_1_a1}`);

    let tx = await jVault_holder.BlockchainAPI.transferAsync(ADDRESSES.bitlayer.USDT, vault_1_a1, ethers.utils.parseUnits("0.1", 6))
    // tx = await jVault_holder.BlockchainAPI.transferNativeTokenAsync(vault_1_a1, ethers.utils.parseEther("0.00005"))
    console.log('transfer test token tx:', tx);
    await tx.wait(1);
    await sendDegenBatchOrders();

    return



    tx = await withdrawERC20(ADDRESSES.bitlayer_test.USDT, "1");
    console.log('withdraw tx:', tx);


    tx = await withdrawETH("0.00001");
    console.log('withdrawETH tx:', tx);


    tx = await depositERC20(ADDRESSES.bitlayer_test.USDT, "1");
    console.log('deposit tx:', tx);

    tx = await depositETH("0.00001");
    console.log('depositETH tx:', tx);

}



async function depositERC20(token_address: string, amount: string) {
    let decimals = await jVault_a1.BlockchainAPI.getDecimalsAsync(token_address);
    let depositAmount = ethers.utils.parseUnits(amount, decimals);

    let depositTx = await jVault_a1.VaultAPI.transfer(
        jVault_a1.EOA,
        await jVault_a1.VaultAPI.getAddress(jVault_a1.config.EOA, 1),
        [token_address],
        [depositAmount],
        {
            maxFeePerGas: feeData == undefined ? ethers.utils.parseUnits(network_config.defaultFeeData.maxFeePerGas, "gwei") : maxFeePerGas,
            maxPriorityFeePerGas: ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"),
        });
    return depositTx;
}

async function depositETH(amount: string) {
    let depositAmount = ethers.utils.parseEther(amount);
    let depositTx = await jVault_a1.VaultAPI.transfer(
        jVault_a1.EOA,
        await jVault_a1.VaultAPI.getAddress(jVault_a1.config.EOA, 1),
        [ADDRESSES.native_token],
        [depositAmount],
        {
            maxFeePerGas: feeData == undefined ? ethers.utils.parseUnits(network_config.defaultFeeData.maxFeePerGas, "gwei") : maxFeePerGas,
            maxPriorityFeePerGas: ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"),
        });
    return depositTx;
}

async function withdrawERC20(token_address: string, amount?: string) {
    let withdrawAmount = ethers.constants.Zero;
    let vault1 = await jVault_a1.VaultAPI.getAddress(jVault_a1.config.EOA, 1);
    if (!amount) {
        withdrawAmount = await jVault_a1.BlockchainAPI.getBalanceAsync(token_address, vault1);
        console.log('withdrawAmount:', withdrawAmount.toString());
    }
    else {
        let decimals = await jVault_a1.BlockchainAPI.getDecimalsAsync(token_address);
        withdrawAmount = ethers.utils.parseUnits(amount, decimals);
    }
    let withdrawTx = await jVault_a1.VaultAPI.transfer(
        vault1,
        jVault_a1.EOA,
        [token_address], [withdrawAmount],
        {
            maxFeePerGas: feeData == undefined ? ethers.utils.parseUnits(network_config.defaultFeeData.maxFeePerGas, "gwei") : maxFeePerGas,
            maxPriorityFeePerGas: ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"),

        });
    return withdrawTx;
}

async function withdrawETH(amount: string) {
    let withdrawAmount = ethers.utils.parseEther(amount);
    let withdrawTx = await jVault_a1.VaultAPI.transfer(
        await jVault_a1.VaultAPI.getAddress(jVault_a1.config.EOA, 1),
        jVault_a1.EOA,
        [ADDRESSES.native_token],
        [withdrawAmount],
        {
            maxFeePerGas: feeData == undefined ? ethers.utils.parseUnits(network_config.defaultFeeData.maxFeePerGas, "gwei") : maxFeePerGas,
            maxPriorityFeePerGas: ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"),
        });
    return withdrawTx;
}

async function sendDegenBatchOrders() {
    if (!config_a1.ethersSigner) {
        return console.log("signer_Holder miss")
    }
    if (!config_a1.ethersProvider || !config_a1.data) {
        return console.log("config_holder provier or data miss")
    }
    let signer_Holder = await config_a1.ethersSigner.getAddress();
    console.log('Holder Signer:' + signer_Holder);
    let writer_config = await jVault_a1.OptionTradingAPI.getOptionWriterSettingsFromAPI();
    let vaults = await jVault_a1.VaultAPI.getWalletToVault(signer_Holder);
    console.log(`vaults.length: ${vaults.length}`);
    let vaults_0 = await jVault_a1.VaultAPI.getAddress(signer_Holder, 0);
    console.log(`blocknumber: ${await config_a1.ethersProvider.getBlockNumber()}`);
    console.log(`Starting place order`);
    let feeData = await config_a1.ethersProvider.getFeeData();
    console.log("feeData:", feeData.lastBaseFeePerGas?.toString());
    let vaults_1 = await jVault_a1.VaultAPI.getAddress(signer_Holder, 1);
    console.log(`vaults_0 ${vaults_0}`, ` vaults_1: ${vaults_1}`);
    let txs: JVaultOrder[] = [];


    txs.push({
        amount: ethers.utils.parseEther('0.0001'),
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
        let tx = await jVault_a1.OptionTradingAPI.createDegenBatchOrders(txs, {
            // maxFeePerGas: feeData.lastBaseFeePerGas?.add(ethers.utils.parseUnits('0.05', 'gwei')),
            // maxPriorityFeePerGas: ethers.utils.parseUnits('0.05', 'gwei'),
            //gasLimit: 5000000
        });
        if (tx) {
            let order = await jVault_a1.OptionTradingAPI.getOrderByHash(tx);
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
