import { JVault } from '../src';
import { JVaultConfig, NetworkConfig } from '../src/utils/types/index';
import { ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
import ParticalHandler from '../src/utils/ParticalHandler';
import CoinbaseHandler from '../src/utils/CoinbaseHandler';
import { coinbaseConfig } from './config/coinbase_config';
import { particalConfig } from './config/partical_config';
let config_holder: JVaultConfig;
// let config_writer: JVaultConfig;
let jVault_holder: JVault;
dotenv.config();
let feeData: FeeData;
let network_name = "bitlayer_test";
let network_config: NetworkConfig = JVault.readNetworkConfig(network_name);
let maxFeePerGas

async function main() {
    let ethersProvider = new ethers.providers.JsonRpcProvider(network_config.rpcUrl);
    if (!process.env.PRIVATE_KEY_HOLDER) {
        throw new Error("PRIVATE_KEY_HOLDER is not defined in the environment variables");
    }
    let ethersSigner = new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER, new ethers.providers.JsonRpcProvider(network_config.rpcUrl));
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
        transactionHandler: particalHandler,
        gasSettings: {
            maxFeePerGas: feeData == undefined ? ethers.utils.parseUnits(network_config.defaultFeeData.maxFeePerGas, "gwei") : maxFeePerGas,
            maxPriorityFeePerGas: ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"),

        }
    };



    jVault_holder = new JVault(config_holder);


    let tx = await depositERC20(ADDRESSES.bitlayer_test.USDT, "1");
    console.log('deposit tx:', tx);
    return;
    tx = await withdrawERC20(ADDRESSES.base.USDC, "1");
    console.log('withdraw tx:', tx);
    tx = await depositETH("0.001");
    console.log('depositETH tx:', tx);
    tx = await withdrawETH("0.001");
    console.log('withdrawETH tx:', tx);
}

async function depositERC20(token_address: string, amount: string) {
    let decimals = await jVault_holder.BlockchainAPI.getDecimalsAsync(token_address);
    let depositAmount = ethers.utils.parseUnits(amount, decimals);

    let depositTx = await jVault_holder.VaultAPI.transfer(
        config_holder.EOA,
        await jVault_holder.VaultAPI.getAddress(jVault_holder.config.EOA, 1),
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
    let depositTx = await jVault_holder.VaultAPI.transfer(
        config_holder.EOA,
        await jVault_holder.VaultAPI.getAddress(jVault_holder.config.EOA, 1),
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
    let vault1 = await jVault_holder.VaultAPI.getAddress(jVault_holder.config.EOA, 1);
    if (!amount) {
        withdrawAmount = await jVault_holder.BlockchainAPI.getBalanceAsync(token_address, vault1);
        console.log('withdrawAmount:', withdrawAmount.toString());
    }
    else {
        let decimals = await jVault_holder.BlockchainAPI.getDecimalsAsync(token_address);
        withdrawAmount = ethers.utils.parseUnits(amount, decimals);
    }
    let withdrawTx = await jVault_holder.VaultAPI.transfer(
        vault1,
        config_holder.EOA,
        [token_address], [withdrawAmount],
        {
            maxFeePerGas: feeData == undefined ? ethers.utils.parseUnits(network_config.defaultFeeData.maxFeePerGas, "gwei") : maxFeePerGas,
            maxPriorityFeePerGas: ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"),

        });
    return withdrawTx;
}

async function withdrawETH(amount: string) {
    let withdrawAmount = ethers.utils.parseEther(amount);
    let withdrawTx = await jVault_holder.VaultAPI.transfer(
        await jVault_holder.VaultAPI.getAddress(jVault_holder.config.EOA, 1),
        config_holder.EOA,
        [jVault_holder.config.data.eth],
        [withdrawAmount],
        {
            maxFeePerGas: feeData == undefined ? ethers.utils.parseUnits(network_config.defaultFeeData.maxFeePerGas, "gwei") : maxFeePerGas,
            maxPriorityFeePerGas: ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"),
        });
    return withdrawTx;
}

main().catch(error => {
    console.error(error);
    // process.exitCode = 1;
});
