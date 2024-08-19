import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address } from '../utils/types';
import { UserOperationStruct } from '@account-abstraction/contracts';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';

export default class EntryPointWrapper {
    private signer: Signer;
    private contracts: ContractWrapper;
    private EntryPointAddress: Address;
    public constructor(signer: Signer, EntryPointAddress: Address) {
        this.signer = signer;
        this.contracts = new ContractWrapper(this.signer);
        this.EntryPointAddress = EntryPointAddress;
    }

    public async getNonce(sender: Address, key: number) {
        const EntryPoint = this.contracts.getEntryPoint(this.EntryPointAddress);
        try {
            return EntryPoint.getNonce(sender, key);
        }
        catch (error) {
            console.error('Error getNonce:', error);
        }
    }
    public async handleOps(op: UserOperationStruct[], beneficiary: Address, txOpts: TransactionOverrides = {}) {
        const EntryPoint = this.contracts.getEntryPoint(this.EntryPointAddress);
        try {
            return EntryPoint.handleOps(op, beneficiary, txOpts);
        }
        catch (error) {
            console.error('Error handleOps:', error);
        }
    }
}