import { JVault } from '../src';
import { JVaultConfig, OptionType, NetworkConfig, JVaultOrder } from '../src/utils/types/index';
import { BigNumber, ethers } from 'ethers';
import { FeeData } from '@ethersproject/abstract-provider'
import * as dotenv from 'dotenv';
import ADDRESSES from "../src/utils/coreAssets.json";
import ParticalHandler from '../src/utils/ParticalHandler';
// import { particalConfig } from './config/partical_config';
let config_holder: JVaultConfig;
// let config_writer: JVaultConfig;
let jVault_holder: JVault;
dotenv.config();
let feeData: FeeData;
let network_config: NetworkConfig = JVault.readNetworkConfig("bitlayer");

async function main() {
    

    console.log("xxl 00001 ",process.env.PRIVATE_KEY_HOLDER);
    if (!process.env.PRIVATE_KEY_HOLDER) {
        throw new Error("PRIVATE_KEY_HOLDER is not defined in the environment variables");
    }

    console.log("xxl 00002 ",network_config.rpcUrl);
    let ethersProvider = new ethers.providers.JsonRpcProvider(network_config.rpcUrl);

    let ethersSigner = new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER, new ethers.providers.JsonRpcProvider(network_config.rpcUrl));
    feeData = await ethersProvider.getFeeData();
    console.log("xxl 00003 ",feeData);

    if (!feeData.lastBaseFeePerGas) {
        throw new Error("lastBaseFeePerGas required");
    }

    let particalHandler: ParticalHandler = new ParticalHandler({
        chainId: network_config.chainId,
        ethersProvider: ethersProvider,
        ethersSigner: ethersSigner,
        minConfirmationCount: 2,
        data: {
            projectUuid: "47ad2d9c-2271-4c27-a4e1-6856db7ffc76",
            projectKey: "sPT2CWrkMe83c4PswqjHgskgQ9Yep9g0CKpZshQ7",
            paymasterUrl: "https://paymaster.particle.network",
            bundlerUrl: "https://bundler.particle.network/#eth_sendUserOperation",
            contractData: {
                EntryPoint: network_config.contractData.EntryPoint,
                VaultFactory: network_config.contractData.VaultFactory
            }
        }
    });


    let maxFeePerGas = feeData.lastBaseFeePerGas.mul(2).add(ethers.utils.parseUnits(network_config.defaultFeeData.maxPriorityFeePerGas, "gwei"))
    console.log("xxl 00005 ",maxFeePerGas);

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
    console.log("xxl 00006 ",config_holder);
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
    console.log('xxl 00007 Holder Signer:' + signer_Holder);
    let writer_config = await jVault_holder.OptionTradingAPI.getOptionWriterSettingsFromAPI();
    let vaults = await jVault_holder.VaultAPI.getWalletToVault(signer_Holder);
    console.log(`xxl 00008 vaults.length: ${vaults.length}`);
    let vaults_0 = await jVault_holder.VaultAPI.getAddress(signer_Holder, 1);
    console.log(`xxl 00009 blocknumber: ${await config_holder.ethersProvider.getBlockNumber()}`);
    console.log(`xxl 00010 Starting place order`);
    let feeData = await config_holder.ethersProvider.getFeeData();
    console.log("xxl 00011 feeData:", feeData.lastBaseFeePerGas?.toString());
    let vaults_1 = await jVault_holder.VaultAPI.initNewAccount();
    console.log(`xxl 00012 vaults_0 ${vaults_0}`, ` vaults_1: ${vaults_1}`);
    let txs: JVaultOrder[] = [];
    BigNumber;

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
    console.log('xxl 00013 signerAddress:', signerAddress);
    const response = await fetch('https://worker-mini-test.fly.dev/api/v2/vaults/getTimeStoneSignature', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            "Authorization": "Bearer 3f4e1a2b-7c9d-4e8f-b2a1-5d6f7e8c9b0a"
        },
        body: JSON.stringify({
            timestamp: timestamp,
            address: signerAddress,
            nftId: 38,
            chainName: "bitlayer"
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
        underlyingAsset: ADDRESSES.bitlayer.BTC,
        optionType: OptionType.CALL,
        premiumAsset: ADDRESSES.bitlayer.USDT,
        optionVault: ethers.constants.AddressZero,
        optionWriter: writer_config.bitlayer.CALL.BTC,
        premiumVault: vaults_1,
        chainId: network_config.chainId,
        secondsToExpiry: 3600 * 2,
        timestamp,
        signature,
        unlockTimeSpan: 3600 * 2 - 30
    });

    console.log("xxl 00013 txs",txs);
 
    try {
        let tx = await jVault_holder.OptionTradingAPI.createDegenBatchOrders(txs, {});
        console.log("xxl 00014 tx",tx);
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
