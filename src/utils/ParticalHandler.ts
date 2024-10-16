import { SimpleAccountAPI } from '@account-abstraction/sdk';
import { Address, BundlerOP } from '../utils/types/index';
import { EntryPointWrapper, VaultWrapper, VaultFactoryWrapper } from '../wrappers/';
import { TransactionResponse } from '@ethersproject/providers';
import { AxiosResponse } from 'axios';
import axios from 'axios';
import sleep from 'sleep-promise';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';
import { ethers } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { Signer } from '@ethersproject/abstract-signer';

import { TransactionHandler } from './JaspervaultTransactionHandler';

export interface ParticalSettings {
    chainId: number;
    ethersProvider: Provider;
    ethersSigner: Signer;
    data: {
        projectUuid: string;
        projectKey: string;
        paymasterUrl: string;
        bundlerUrl: string;
        contractData: {
            EntryPoint: Address;
            VaultFactory: Address;
        };
    };
}

class ParticalHandler implements TransactionHandler {
    private accountAPI: SimpleAccountAPI;
    private EntryPointWrapper: EntryPointWrapper;
    private VaultFactoryWrapper: VaultFactoryWrapper;
    private settings: ParticalSettings;

    constructor(settings: ParticalSettings) {
        this.settings = settings;
        this.EntryPointWrapper = new EntryPointWrapper(settings.ethersSigner, settings.data.contractData.EntryPoint);
        this.VaultFactoryWrapper = new VaultFactoryWrapper(settings.ethersSigner, settings.data.contractData.VaultFactory);

        this.accountAPI = new SimpleAccountAPI({
            provider: settings.ethersProvider,
            entryPointAddress: settings.data.contractData.EntryPoint,
            owner: settings.ethersSigner,
            factoryAddress: settings.data.contractData.VaultFactory,
            index: 0,
        });


    }

    async sendTransaction(
        vault: Address,
        op_arr: BundlerOP[],
        txOpts: TransactionOverrides = {}
    ): Promise<string> {
        const chainID = this.settings.chainId;
        const dest = [];
        const value = [];
        const func = [];
        let vaule_tx = ethers.constants.Zero;

        op_arr.forEach(element => {
            dest.push(element.dest);
            console.log(element.value);
            value.push(element.value);
            vaule_tx = vaule_tx.add(element.value);
            func.push(element.data);
        });
        const vaultIndex = await this.VaultFactoryWrapper.getVaultToSalt(vault);
        this.accountAPI = new SimpleAccountAPI({
            provider: this.settings.ethersProvider,
            entryPointAddress: this.settings.data.contractData.EntryPoint,
            owner: this.settings.ethersSigner,
            factoryAddress: this.settings.data.contractData.VaultFactory,
            index: vaultIndex,
        });
        const nonce = await this.EntryPointWrapper.getNonce(vault, 0);
        const initCode = '0x';

        const Vault = new VaultWrapper(this.settings.ethersSigner, vault);
        const calldata = await Vault.executeBatch(dest, value, func, true);
        // const feeData: FeeData = await this.config.ethersProvider.getFeeData();
        // const {
        //    maxPriorityFeePerGas, lastBaseFeePerGas
        // } = feeData

        const unsignOp = {
            sender: vault,
            nonce: nonce,
            initCode: initCode,
            callData: calldata,
            callGasLimit: 3500000,
            verificationGasLimit: 500000,
            maxFeePerGas: txOpts.maxFeePerGas,
            maxPriorityFeePerGas: txOpts.maxPriorityFeePerGas,
            // paymasterAndData: "0x",
            paymasterAndData: '0x',
            preVerificationGas: 500000,
            signature: '0x',
        };
        const projectUuid = this.settings.data.projectUuid;
        const projectKey = this.settings.data.projectKey;
        const entryPoint = this.settings.data.contractData.EntryPoint;
        const paymasterUrl = `${this.settings.data.paymasterUrl}#pm_sponsorUserOperation`;
        const userOp = {
            'sender': unsignOp.sender,
            'nonce': this.toHex(await unsignOp.nonce),
            'initCode': unsignOp.initCode,
            'callData': await unsignOp.callData,
            'callGasLimit': this.toHex(unsignOp.callGasLimit),
            'verificationGasLimit': this.toHex(unsignOp.verificationGasLimit),
            'maxFeePerGas': this.toHex(unsignOp.maxFeePerGas),
            'maxPriorityFeePerGas': this.toHex(unsignOp.maxPriorityFeePerGas),
            'paymasterAndData': unsignOp.paymasterAndData,
            'preVerificationGas': this.toHex(unsignOp.preVerificationGas),
            'signature': unsignOp.signature,
        };
        let res = await axios.post(paymasterUrl,
            {
                method: 'pm_sponsorUserOperation',
                params: [userOp, entryPoint],
            },
            {
                params: {
                    chainId: chainID,
                    projectUuid: projectUuid,
                    projectKey: projectKey,
                },
            }
        );
        if (!res || !res.data || !res.data.result || !res.data.result.paymasterAndData) {
            console.log(res.data, 'pm_sponsorUserOperation fail');
        }

        userOp.paymasterAndData = res.data.result.paymasterAndData;
        console.log(userOp);
        const op = await this.accountAPI.signUserOp(userOp);

        const options = {
            'method': 'eth_sendUserOperation',
            'params': [{
                'sender': await op.sender,
                'nonce': await op.nonce,
                'initCode': await op.initCode,
                'callData': await op.callData,
                'callGasLimit': await op.callGasLimit,
                'verificationGasLimit': await op.verificationGasLimit,
                'maxFeePerGas': op.maxFeePerGas,
                'maxPriorityFeePerGas': op.maxPriorityFeePerGas,
                'paymasterAndData': await op.paymasterAndData,
                'preVerificationGas': await op.preVerificationGas,
                'signature': await op.signature,
            }, entryPoint],
            'id': 1,
            'jsonrpc': '2.0',
            'chainId': chainID,
        };
        console.log(options);
        const bundlerUrl = `${this.settings.data.bundlerUrl}#eth_sendUserOperation`;
        console.log('bundlerUrl', bundlerUrl);
        res = await axios.post(bundlerUrl, options);
        if (res.data.error) {
            console.log('eth_sendUserOperation error: ', res.data);
            // var dataField = JSON.parse(res.data.error.message.match(/{.*?}$/)[0]).error.data;
            // console.log("particle eth_sendUserOperation parseRevertReason: ", parseRevertReason(dataField))
            return;
        }
        const tx = await this.getUserOpByHash(res);
        await tx.wait(1);
        console.log('<tx hash>', tx.hash);
        txOpts;
        return tx.hash;
    }
    async getUserOpByHash(res, timeout = 30, interval = 2) {
        const params = {
            'method': 'eth_getUserOperationByHash',
            'params': [
                res.data.result,
            ],
            'id': 1,
            'jsonrpc': '2.0',
            'chainId': this.settings.chainId,
        };
        const tokenUrl = `${this.settings.data.bundlerUrl}#eth_getUserOperationByHash`;
        let hash;
        const endtime = Date.now() + timeout * 1000;
        let transaction;
        while (Date.now() < endtime) {
            res = await axios.post(tokenUrl, params);
            //  console.log("res",  await res.data)
            if (res && res.data && res.data.result && res.data.result.transactionHash) {
                hash = res.data.result.transactionHash;
                while (!transaction) {
                    transaction = await this.settings.ethersProvider.getTransaction(hash);
                    await sleep(500);
                }
                break;
            }
            await new Promise(resolve => setTimeout(resolve, interval * 1000));

        }
        return await this.settings.ethersProvider.getTransaction(hash);
    }

    async getOperationHash(orderID: string, timeout: number, interval: number) {
        let orderResponse: AxiosResponse = undefined;
        let hash: string = undefined;
        const endtime = Date.now() + timeout * 1000;
        const tokenUrl = `${this.settings.data.bundlerUrl}/tyche/api/order/get`;
        let transaction: TransactionResponse = undefined;
        while (Date.now() < endtime) {
            // console.log("order-----------------------------------", orderID)
            const data = {
                'orderID': String(orderID),
            };
            orderResponse = await axios.post(tokenUrl, data);
            // console.log("orderResponse", orderResponse.data)

            if (orderResponse && orderResponse.data && orderResponse.data.data && orderResponse.data.data.txHash) {
                hash = orderResponse.data.data.txHash;
                while (!transaction) {
                    transaction = await this.settings.ethersProvider.getTransaction(hash);
                    await sleep(500);
                }
                break;
            }
            await new Promise(resolve => setTimeout(resolve, interval * 1000));

        }
        return await this.settings.ethersProvider.getTransaction(hash);
    }
    toHex(n) {
        return '0x' + String(Number(n).toString(16));
    }
}
export default ParticalHandler;