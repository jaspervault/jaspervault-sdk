import { SimpleAccountAPI } from '@account-abstraction/sdk';
import { Address, BundlerOP } from './types/index';
import { EntryPointWrapper, VaultWrapper, VaultFactoryWrapper } from '../wrappers';
import { TransactionResponse } from '@ethersproject/providers';
import { AxiosResponse } from 'axios';
import axios from 'axios';
import sleep from 'sleep-promise';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';
import { ethers, BigNumber } from 'ethers';
import { Provider } from '@ethersproject/providers';
import { Signer } from '@ethersproject/abstract-signer';
import { FeeData } from '@ethersproject/abstract-provider';
import { TransactionHandler } from './JaspervaultTransactionHandler';

export interface CoinbaseSettings {
    chainId: number;
    bundlerUrl: string;
    ethersProvider: Provider;
    ethersSigner: Signer;
    data: {
        contractData: {
            EntryPoint: Address;
            VaultFactory: Address;
        };
    };
}

class CoinbaseHandler implements TransactionHandler {
    private accountAPI: SimpleAccountAPI;
    private EntryPointWrapper: EntryPointWrapper;
    private VaultFactoryWrapper: VaultFactoryWrapper;
    private settings: CoinbaseSettings;

    constructor(settings: CoinbaseSettings) {
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
        const code = await this.settings.ethersProvider.getCode(vault);


        let vaule_tx = ethers.constants.Zero;
        op_arr.forEach(element => {
            dest.push(element.dest);
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
            const ethersFeeData: FeeData = await this.settings.ethersProvider.getFeeData();
            maxFeePerGas = ethersFeeData.lastBaseFeePerGas.mul(BigNumber.from('120')).div(BigNumber.from('100'));
            if (ethersFeeData.lastBaseFeePerGas.lt(ethers.utils.parseUnits('0.005', 'gwei'))) {
                console.log('lastBaseFeePerGas too low--->', ethers.utils.formatUnits(ethersFeeData.lastBaseFeePerGas, 'gwei'));
                maxPriorityFeePerGas = ethersFeeData.lastBaseFeePerGas.mul(BigNumber.from('120')).div(BigNumber.from('100'));
                maxFeePerGas = ethersFeeData.lastBaseFeePerGas.mul(BigNumber.from('150')).div(BigNumber.from('100'));

            }
            else {
                maxPriorityFeePerGas = ethersFeeData.lastBaseFeePerGas.mul(BigNumber.from('60')).div(BigNumber.from('100'));
            }
        }
        const unsignOp = {
            sender: vault,
            nonce: nonce,
            initCode: initCode,
            callData: calldata,
            callGasLimit: 3500000,
            verificationGasLimit: 500000,
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            paymasterAndData: '0x',
            preVerificationGas: 500000,
            signature: '0x8a1e1504ab48d24cc6cb0ed990d94330297d857b4fd90aba9c3fae0adb80d10c76f2cfd253627baca1630e797e94864c29637846e7d8f18728d1fb481a89f5791c',
        };

        const entryPoint = this.settings.data.contractData.EntryPoint;
        const paymasterUrl = this.settings.bundlerUrl;
        const bundlerUrl = `${this.settings.bundlerUrl}`;
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
                'callGasLimit': await userOp.callGasLimit,
                'verificationGasLimit': await userOp.verificationGasLimit,
                'maxFeePerGas': userOp.maxFeePerGas,
                'maxPriorityFeePerGas': userOp.maxPriorityFeePerGas,
                'paymasterAndData': await userOp.paymasterAndData,
                'preVerificationGas': await userOp.preVerificationGas,
                'signature': await userOp.signature,
            }, entryPoint],
            'id': 1,
            'jsonrpc': '2.0',
        };
        console.log(estimateOp_options);
        let res = await axios.post(bundlerUrl, estimateOp_options);
        if (res.data.error) {
            console.log('eth_estimateUserOperationGas error: ', res.data);
            return;
        }
        console.log('estimate gas', res.data.result);
        const preVerificationGas = parseInt((res.data.result.preVerificationGas * 1.2).toString());
        userOp.preVerificationGas = this.toHex(preVerificationGas);
        userOp.verificationGasLimit = this.toHex(res.data.result.verificationGasLimit);
        userOp.callGasLimit = this.toHex(res.data.result.callGasLimit);


        res = await axios.post(paymasterUrl,
            {
                jsonrpc: '2.0',
                id: 1,
                method: 'pm_getPaymasterData',
                params: [
                    userOp,
                    entryPoint,
                    `0x${chainID.toString(16)}`,
                    {},
                ],
            }
        );
        if (!res || !res.data || !res.data.result || !res.data.result.paymasterAndData) {
            console.log(res.data, 'pm_getPaymasterData fail');
        }

        userOp.paymasterAndData = res.data.result.paymasterAndData;


        const op = await this.accountAPI.signUserOp(userOp);

        console.log(op);
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
        };
        console.log(options);

        console.log('bundlerUrl', bundlerUrl);
        res = await axios.post(bundlerUrl, options);
        console.log(res);
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
        console.log('hash', res.data.result);
        const params = {
            'method': 'eth_getUserOperationByHash',
            'params': [
                res.data.result,
            ],
            'id': 1,
            'jsonrpc': '2.0',
            'chainId': this.settings.chainId,
        };
        const tokenUrl = `${this.settings.bundlerUrl}`;
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
        const tokenUrl = `${this.settings.bundlerUrl}/tyche/api/order/get`;
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
export default CoinbaseHandler;