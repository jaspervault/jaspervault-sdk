
import { ethers } from 'ethers';
import { VaultWrapper } from '../wrappers';
import { EventEmitter } from 'events';

import { JVaultConfig, Address, BundlerOP } from './types/index';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';

export interface TransactionHandler {
    sendTransaction(vault: Address,
        op_arr: BundlerOP[],
        txOpts?: TransactionOverrides): Promise<string>;

    getEventEmitter(): EventEmitter;
}

export class JaspervaultTransactionHandler implements TransactionHandler {
    private config: JVaultConfig;
    private eventEmitter: EventEmitter;

    constructor(config: JVaultConfig) {
        this.config = config;
        this.eventEmitter = new EventEmitter();
    }

    public getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }


    async sendTransaction(
        vault: Address,
        op_arr: BundlerOP[],
        txOpts: TransactionOverrides = {}
    ): Promise<string> {
        if (vault == ethers.constants.AddressZero) {
            if (op_arr.length != 1) {
                throw new Error('Invalid operation');
            }

            this.eventEmitter.emit('beforeSubmitToBundler', op_arr);
            const tx = await this.config.ethersSigner.sendTransaction({
                to: op_arr[0].dest,
                data: op_arr[0].data,
                value: op_arr[0].value,
                ...txOpts,
            });
            this.eventEmitter.emit('afterSubmitToBundler', tx);
            await tx.wait(this.config.data.safeBlock);
            return tx.hash;
        }
        else {
            const dest = [];
            const value = [];
            const func = [];
            op_arr.forEach(element => {
                dest.push(element.dest);
                value.push(element.value);
                func.push(element.data);
            });
            const vaultCode = await this.config.ethersProvider.getCode(vault);
            if (vaultCode == '0x') {
                throw new Error('Vault not exist');
            }
            const Vault = new VaultWrapper(this.config.ethersSigner, vault);
            this.eventEmitter.emit('beforeSubmitToBundler', op_arr);
            const tx = await Vault.executeBatch(dest, value, func, false, txOpts);
            this.eventEmitter.emit('afterSubmitToBundler', tx);
            await tx.wait(this.config.data.safeBlock);
            return tx.hash;
        }
    }
}

