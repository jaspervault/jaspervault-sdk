import { SimpleAccountAPI } from '@account-abstraction/sdk';
import { Address, BundlerOP } from './types/index';
import { EntryPointWrapper, VaultWrapper, VaultFactoryWrapper } from '../wrappers';
import { TransactionResponse } from '@ethersproject/providers';
import { AxiosResponse } from 'axios';
import axios from 'axios';
import sleep from 'sleep-promise';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';
import { ethers } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { Signer } from '@ethersproject/abstract-signer';

import { TransactionHandler } from './JaspervaultTransactionHandler';
import { EventEmitter } from 'events'; ``;

export interface BitlayerBundlerSettings {
    chainId: number;
    ethersProvider: Provider;
    ethersSigner: Signer;
    minConfirmationCount?: number;
    data: {
        projectAPIKey: string;
        paymasterUrl: string;
        bundlerUrl: string;
        contractData: {
            EntryPoint: Address;
            VaultFactory: Address;
        };
    };
}

class BitlayerBundlerHandler implements TransactionHandler {
    private accountAPI: SimpleAccountAPI;
    private EntryPointWrapper: EntryPointWrapper;
    private VaultFactoryWrapper: VaultFactoryWrapper;
    private settings: BitlayerBundlerSettings;
    private eventEmitter: EventEmitter;

    constructor(settings: BitlayerBundlerSettings) {
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
        let vaule_tx = ethers.constants.Zero;

        op_arr.forEach(element => {
            dest.push(element.dest);
            value.push(element.value);
            vaule_tx = vaule_tx.add(element.value);
            func.push(element.data);
        });
        let vaultIndex = await this.VaultFactoryWrapper.getVaultToSalt(vault);
        if (vaultIndex == 0) {
            const vault_salt = 1;
            while (vaultIndex == 0) {
                const vault_address = await this.VaultFactoryWrapper.getAddress(await this.settings.ethersSigner.getAddress(), vault_salt);
                if (vault_address == vault) {
                    vaultIndex = vault_salt;
                    break;
                }
            }
        }
        this.accountAPI = new SimpleAccountAPI({
            provider: this.settings.ethersProvider,
            entryPointAddress: this.settings.data.contractData.EntryPoint,
            owner: this.settings.ethersSigner,
            factoryAddress: this.settings.data.contractData.VaultFactory,
            index: vaultIndex,
        });
        const nonce = await this.EntryPointWrapper.getNonce(vault, 0);
        let initCode = '0x';
        const code = await this.settings.ethersProvider.getCode(vault);
        if (code == '0x') {
            initCode = await this.accountAPI.getAccountInitCode();
        }
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
            paymasterAndData: '0x',
            preVerificationGas: 500000,
            signature: '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c',
        };
        const projectAPIKey = this.settings.data.projectAPIKey;
        const entryPoint = this.settings.data.contractData.EntryPoint;
        const paymasterUrl = `${this.settings.data.paymasterUrl}`;
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

        const estimateOp_options = {
            'method': 'eth_estimateUserOperationGas',
            'params': [{
                'sender': await userOp.sender,
                'nonce': await userOp.nonce,
                'initCode': await userOp.initCode,
                'callData': await userOp.callData,
                'signature': await userOp.signature,
                'callGasLimit': 0,
                'maxFeePerGas': 0,
                'maxPriorityFeePerGas': 0,
                'verificationGasLimit': 0,
                'preVerificationGas': 0,
                'paymasterAndData': await userOp.paymasterAndData,
            }, entryPoint],
            'id': 1,
            'jsonrpc': '2.0',
            'chainId': chainID,
        };
        let res = await axios.post(`${this.settings.data.bundlerUrl}`, estimateOp_options);
        if (res.data.error) {
            console.log('eth_estimateUserOperationGas error: ', res.data);
            return;
        }
        userOp.preVerificationGas = this.toHex(res.data.result.preVerificationGas);
        userOp.verificationGasLimit = this.toHex(res.data.result.verificationGasLimit);
        userOp.callGasLimit = this.toHex(res.data.result.callGasLimit);
        // userOp.preVerificationGas = this.toHex(0);
        // userOp.verificationGasLimit = this.toHex(0);
        // userOp.callGasLimit = this.toHex(0);
        let maxFeePerGas = txOpts.maxFeePerGas;
        let maxPriorityFeePerGas = txOpts.maxPriorityFeePerGas;
        // if (maxFeePerGas) {
        //     console.log(maxFeePerGas)
        //     console.log(ethers.utils.formatUnits(maxFeePerGas, 'gwei'));
        //     console.log(ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei'));
        //     console.log(ethers.utils.formatUnits(res.data.result.maxFeePerGas, 'gwei'));
        //     console.log(ethers.utils.formatUnits(res.data.result.maxPriorityFeePerGas, 'gwei'));
        // }
        if (!maxFeePerGas || !maxPriorityFeePerGas) {
            maxFeePerGas = res.data.result.maxFeePerGas;
            maxPriorityFeePerGas = res.data.result.maxPriorityFeePerGas;
        }
        userOp.maxFeePerGas = this.toHex(maxFeePerGas);
        userOp.maxPriorityFeePerGas = this.toHex(maxPriorityFeePerGas);

        res = await axios.post(paymasterUrl,
            {
                id: 1,
                jsonrpc: '2.0',
                method: 'pm_sponsor_userop',
                params: [userOp, projectAPIKey, entryPoint, { type: '0', token: '0x' }],
            }

        );
        if (!res || !res.data || !res.data.result || !res.data.result.paymasterAndData) {
            console.log('pm_sponsorUserOperation fail', res.data);
        }

        userOp.paymasterAndData = res.data.result.paymasterAndData;
        userOp.preVerificationGas = res.data.result.preVerificationGas;
        userOp.verificationGasLimit = res.data.result.verificationGasLimit;
        userOp.callGasLimit = res.data.result.callGasLimit;
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
        this.eventEmitter.emit('beforeSubmitToBundler', op_arr);

        res = await axios.post(`${this.settings.data.bundlerUrl}`, options);
        if (res.data.error) {
            console.log('eth_sendUserOperation error: ', res.data);
            // var dataField = JSON.parse(res.data.error.message.match(/{.*?}$/)[0]).error.data;
            // console.log("particle eth_sendUserOperation parseRevertReason: ", parseRevertReason(dataField))
            return;
        }
        const tx = await this.getUserOpByHash(res);
        this.eventEmitter.emit('afterSubmitToBundler', tx);

        await tx.wait(this.settings.minConfirmationCount ?? 1);
        console.log('<tx hash>', tx.hash);
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
export default BitlayerBundlerHandler;