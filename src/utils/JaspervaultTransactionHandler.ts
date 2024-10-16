
import { VaultWrapper } from '../wrappers';

import { JVaultConfig, Address, BundlerOP } from './types/index';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';

export interface TransactionHandler {
    sendTransaction(vault: Address,
        op_arr: BundlerOP[],
        txOpts?: TransactionOverrides): Promise<string>;
}

export class JaspervaultTransactionHandler implements TransactionHandler {
    private config: JVaultConfig;
    constructor(config: JVaultConfig) {
        this.config = config;
    }

    async sendTransaction(
        vault: Address,
        op_arr: BundlerOP[],
        txOpts: TransactionOverrides = {}
    ): Promise<string> {
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
        const tx = await Vault.executeBatch(dest, value, func, false, txOpts);
        await tx.wait(this.config.data.safeBlock);
        return tx.hash;
    }
}

