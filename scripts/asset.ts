import { JVault } from '../src';
import { JVaultConfig, NetworkConfig } from '../src/utils/types/index';
import { ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";

let config_holder: JVaultConfig;
// let config_writer: JVaultConfig;
let jVault_holder: JVault;
dotenv.config();
let feeData: FeeData;
let network_config: NetworkConfig = JVault.readNetworkConfig("base");

async function main() {
    let ethersProvider = new ethers.providers.JsonRpcProvider(network_config.rpcUrl);
    if (!process.env.PRIVATE_KEY_HOLDER) {
        throw new Error("PRIVATE_KEY_HOLDER is not defined in the environment variables");
    }
    let ethersSigner = new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER, new ethers.providers.JsonRpcProvider(network_config.rpcUrl));
    feeData = await ethersProvider.getFeeData();
    feeData;
    config_holder = {
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        network: network_config.name,
        EOA: ethersSigner.address
    };
    jVault_holder = new JVault(config_holder);
    let tx = await depositERC20(ADDRESSES.base.USDC, "1");
    console.log('deposit tx:', tx);
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
            maxFeePerGas: feeData.lastBaseFeePerGas?.mul(110).div(100)?.add(ethers.utils.parseUnits('0.001', 'gwei')),
            maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
        });
    return depositTx;
}

async function depositETH(amount: string) {
    let depositAmount = ethers.utils.parseEther(amount);
    let depositTx = await jVault_holder.VaultAPI.transfer(
        config_holder.EOA,
        await jVault_holder.VaultAPI.getAddress(jVault_holder.config.EOA, 1),
        [jVault_holder.config.data.eth],
        [depositAmount],
        {
            maxFeePerGas: feeData.lastBaseFeePerGas?.mul(110).div(100)?.add(ethers.utils.parseUnits('0.001', 'gwei')),
            maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
        });
    return depositTx;
}

async function withdrawERC20(token_address: string, amount: string) {
    let decimals = await jVault_holder.BlockchainAPI.getDecimalsAsync(token_address);
    let withdrawAmount = ethers.utils.parseUnits(amount, decimals);
    let withdrawTx = await jVault_holder.VaultAPI.transfer(
        await jVault_holder.VaultAPI.getAddress(jVault_holder.config.EOA, 1),
        config_holder.EOA,
        [token_address], [withdrawAmount],
        {
            maxFeePerGas: feeData.lastBaseFeePerGas?.mul(110).div(100)?.add(ethers.utils.parseUnits('0.001', 'gwei')),
            maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
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
            maxFeePerGas: feeData.lastBaseFeePerGas?.mul(110).div(100)?.add(ethers.utils.parseUnits('0.001', 'gwei')),
            maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei')
        });
    return withdrawTx;
}

main().catch(error => {
    console.error(error);
    // process.exitCode = 1;
});
