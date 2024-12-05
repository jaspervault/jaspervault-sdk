import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address, Bytes } from '../utils/types';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';

export default class VaultWrapper {
    private signer: Signer;
    private contracts: ContractWrapper;
    private VaultAddress: Address;
    public constructor(signer: Signer, VaultAddress: Address) {
        this.signer = signer;
        this.contracts = new ContractWrapper(this.signer);
        this.VaultAddress = VaultAddress;
    }

    public async executeBatch(dest: Address[], value: number[], func: Bytes[], encodeFunc?: boolean, txOpts: TransactionOverrides = {}
    ) {
        const Vault = this.contracts.getVault(this.VaultAddress);
        try {
            if (encodeFunc) {
                return Vault.interface.encodeFunctionData('executeBatch', [dest, value, func]);
            }
            else {
                return await Vault.executeBatch(dest, value, func, txOpts);
            }
        }
        catch (error) {
            console.error('Error executeBatch:', error);
        }
    }

}