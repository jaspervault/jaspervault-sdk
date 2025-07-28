import { SimpleAccountAPI } from '@account-abstraction/sdk';
import { Address, BundlerOP } from './types/index';
import { EntryPointWrapper, VaultWrapper, VaultFactoryWrapper } from '../wrappers';
import { TransactionResponse } from '@ethersproject/providers';
import axios from 'axios';
import sleep from 'sleep-promise';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';
import { ethers } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { Signer } from '@ethersproject/abstract-signer';
import { TransactionHandler } from './JaspervaultTransactionHandler';
import { EventEmitter } from 'events';

export interface AlchemySettings {
    chainId: number;
    apiKey: string;
    gasManagerPolicyId: string;
    ethersProvider: Provider;
    ethersSigner: Signer;
    data: {
        contractData: {
            EntryPoint: Address;
            VaultFactory: Address;
        };
    };
}

class AlchemyBundlerHandler implements TransactionHandler {
    private accountAPI: SimpleAccountAPI;
    private EntryPointWrapper: EntryPointWrapper;
    private VaultFactoryWrapper: VaultFactoryWrapper;
    private settings: AlchemySettings;
    private eventEmitter: EventEmitter;

    constructor(settings: AlchemySettings) {
        this.settings = settings;
        this.EntryPointWrapper = new EntryPointWrapper(settings.ethersSigner, settings.data.contractData.EntryPoint);
        this.VaultFactoryWrapper = new VaultFactoryWrapper(settings.ethersSigner, settings.data.contractData.VaultFactory);
        this.eventEmitter = new EventEmitter();

        this.accountAPI = new SimpleAccountAPI({
            provider: settings.ethersProvider,
            entryPointAddress: settings.data.contractData.EntryPoint,
            owner: settings.ethersSigner,
            factoryAddress: settings.data.contractData.VaultFactory,
            index: 0,
        });
    }

    public getEventEmitter(): EventEmitter {
        return this.eventEmitter;
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
        const code = await this.settings.ethersProvider.getCode(vault);

        op_arr.forEach(element => {
            dest.push(element.dest);
            value.push(element.value);
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

        let initCode = '0x';
        if (code == '0x') {
            initCode = await this.accountAPI.getAccountInitCode();
        }

        const nonce = await this.EntryPointWrapper.getNonce(vault, 0);
        const Vault = new VaultWrapper(this.settings.ethersSigner, vault);
        const calldata = await Vault.executeBatch(dest, value, func, true);

        let maxFeePerGas = txOpts.maxFeePerGas;
        let maxPriorityFeePerGas = txOpts.maxPriorityFeePerGas;

        if (!maxFeePerGas || !maxPriorityFeePerGas) {
            let feeData;
            if (chainID == 8453) {
                feeData = {
                    'maxFeePerGas': ethers.utils.parseUnits('0.01', 'gwei'),
                    'maxPriorityFeePerGas': ethers.utils.parseUnits('0.001', 'gwei'),
                };
            } else if (chainID == 42161) {
                feeData = {
                    'maxFeePerGas': ethers.utils.parseUnits('0.01', 'gwei'),
                    'maxPriorityFeePerGas': ethers.utils.parseUnits('0.001', 'gwei'),
                };
            } else {
                feeData = {
                    'maxFeePerGas': ethers.utils.parseUnits('0.005', 'gwei'),
                    'maxPriorityFeePerGas': ethers.utils.parseUnits('0.0001', 'gwei'),
                };
            }
            maxFeePerGas = feeData.maxFeePerGas;
            maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
        }

        console.log('maxFeePerGas', ethers.utils.formatUnits(maxFeePerGas, 'gwei'));
        console.log('maxPriorityFeePerGas', ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei'));

        const entryPoint = this.settings.data.contractData.EntryPoint;
        const bundlerUrl = this.getBundlerUrl(chainID);

        const userOp = {
            'sender': vault,
            'nonce': this.toHex(nonce),
            'initCode': initCode,
            'callData': await calldata,
            'callGasLimit': this.toHex(5800000),
            'verificationGasLimit': this.toHex(500000),
            'maxFeePerGas': this.toHex(maxFeePerGas),
            'maxPriorityFeePerGas': this.toHex(maxPriorityFeePerGas),
            'paymasterAndData': '0x',
            'preVerificationGas': this.toHex(500000),
            'signature': '0x',
        };

        // Request gas and paymaster data from Alchemy
        let res = await axios.post(bundlerUrl, {
            method: 'alchemy_requestGasAndPaymasterAndData',
            params: [
                {
                    policyId: this.settings.gasManagerPolicyId,
                    entryPoint: entryPoint,
                    userOperation: userOp,
                    dummySignature: '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c',
                },
            ],
            'id': 1695717515,
            'jsonrpc': '2.0',
        }, {
            timeout: 30 * 1000,
            headers: { 'Content-Type': 'application/json' },
        });

        if (!res || !res.data || !res.data.result || res.data.error) {
            console.log(res.data, 'alchemy_requestGasAndPaymasterAndData fail');
            return;
        }

        const gasData = res.data.result || res.data.entrypointV06Response;
        if (gasData) {
            if (gasData.maxFeePerGas) userOp.maxFeePerGas = gasData.maxFeePerGas;
            if (gasData.maxPriorityFeePerGas) userOp.maxPriorityFeePerGas = gasData.maxPriorityFeePerGas;
            if (gasData.preVerificationGas) userOp.preVerificationGas = gasData.preVerificationGas;
            if (gasData.verificationGasLimit) userOp.verificationGasLimit = gasData.verificationGasLimit;
            if (gasData.callGasLimit) userOp.callGasLimit = gasData.callGasLimit;
            if (gasData.paymasterAndData) userOp.paymasterAndData = gasData.paymasterAndData;
        }


        // Request paymaster data
        res = await axios.post(bundlerUrl, {
            method: 'alchemy_requestPaymasterAndData',
            params: [
                {
                    policyId: this.settings.gasManagerPolicyId,
                    entryPoint: entryPoint,
                    userOperation: userOp,
                },
            ],
            'id': 1,
            'jsonrpc': '2.0',
        }, {
            timeout: 30 * 1000,
            headers: { 'Content-Type': 'application/json' },
        });

        if (!res || !res.data || !res.data.result || !res.data.result.paymasterAndData) {
            console.log('alchemy_requestPaymasterAndData fail: ', res.data);
            return;
        }

        const paymasterData = res.data.result;
        userOp.paymasterAndData = paymasterData.paymasterAndData;

        // Sign the user operation
        const signedUserOp = await this.accountAPI.signUserOp(userOp);
        const finalUserOp = {
            'sender': await signedUserOp.sender,
            'nonce': await signedUserOp.nonce,
            'initCode': await signedUserOp.initCode,
            'callData': await signedUserOp.callData,
            'callGasLimit': await signedUserOp.callGasLimit,
            'verificationGasLimit': await signedUserOp.verificationGasLimit,
            'maxFeePerGas': signedUserOp.maxFeePerGas,
            'maxPriorityFeePerGas': signedUserOp.maxPriorityFeePerGas,
            'paymasterAndData': await signedUserOp.paymasterAndData,
            'preVerificationGas': await signedUserOp.preVerificationGas,
            'signature': await signedUserOp.signature,
        };

        const options = this.createJsonRpcRequest('eth_sendUserOperation', [finalUserOp, entryPoint]);

        this.eventEmitter.emit('beforeSubmitToBundler', op_arr);
        res = await axios.post(bundlerUrl, options, {
            timeout: 30 * 1000,
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.data.error) {
            console.log('eth_sendUserOperation error: ', res.data);
            return;
        }

        const tx = await this._getUserOpByHash(res, 30, 2, chainID);
        this.eventEmitter.emit('afterSubmitToBundler', tx);
        await tx.wait(1);
        console.log('<tx hash>', tx.hash);
        return tx.hash;
    }

    private async _getUserOpByHash(res: any, timeout = 30, interval = 2, chainID = 42161): Promise<TransactionResponse> {
        if (!res || !res.data || !res.data.result) {
            console.log('getUserOpByHash Alchemy Bundler fail', res.data);
            throw new Error('getUserOpByHash Alchemy Bundler fail');
        }

        console.log('getUserOpByHash', res.data.result);
        const bundlerUrl = this.getBundlerUrl(chainID);

        const params = this.createJsonRpcRequest('eth_getUserOperationByHash', [res.data.result]);

        let hash: string;
        const endtime = Date.now() + timeout * 1000;
        let transaction: TransactionResponse = undefined;

        while (Date.now() < endtime) {
            const opRes = await axios.post(bundlerUrl, params, {
                timeout: 30 * 1000,
                headers: { 'Content-Type': 'application/json' },
            });

            if (opRes && opRes.data && opRes.data.result && opRes.data.result.transactionHash) {
                //   console.log("transactionHash", opRes.data.result);
                hash = opRes.data.result.transactionHash;
                while (!transaction) {
                    console.log('waiting transactionHash', hash);
                    transaction = await this.settings.ethersProvider.getTransaction(hash);
                    await sleep(500);
                }
                break;
            }
            await new Promise(resolve => setTimeout(resolve, interval * 1000));
        }

        return await this.settings.ethersProvider.getTransaction(hash);
    }

    private getBundlerUrl(chainID: number): string {
        if (chainID == 8453) {
            return `https://base-mainnet.g.alchemy.com/v2/${this.settings.apiKey}`;
        } else {
            return `https://arb-mainnet.g.alchemy.com/v2/${this.settings.apiKey}`;
        }
    }

    private toHex(n: any): string {
        return '0x' + String(Number(n).toString(16));
    }

    private createJsonRpcRequest(method: string, params: any[]): any {
        return {
            jsonrpc: '2.0',
            id: 1,
            method: method,
            params: params,
        };
    }
}

export default AlchemyBundlerHandler;
