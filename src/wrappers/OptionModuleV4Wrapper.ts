import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address, TransactionOverrides } from '../utils/types';
import { IOptionModuleV2 } from '@jaspervault/contracts-v2/dist/types/typechain/contracts/interfaces/internal/IOptionModuleV2';

export default class OptionModuleV4Wrapper {
    private signer: Signer;
    private contracts: ContractWrapper;
    private OptionModuleV4Address: Address;

    public constructor(signer: Signer, optionModuleV4Address: Address) {
        this.signer = signer;
        this.contracts = new ContractWrapper(this.signer);
        this.OptionModuleV4Address = optionModuleV4Address;
    }

    public async submitManagedOrderV4(order: IOptionModuleV2.ManagedOrderStruct,
        encodeFunc?: boolean,
        txOpts: TransactionOverrides = {}): Promise<string | any> {
        try {
            const optionModuleV4 = this.contracts.getOptionModuleV4(this.OptionModuleV4Address);
            if (encodeFunc) {
                return optionModuleV4.interface.encodeFunctionData('submitManagedOrderV4', [order]);
            }
            else {
                return optionModuleV4.submitManagedOrderV4(order, txOpts);
            }
        }
        catch (error) {
            console.error('Error submitManagedOrderV4', error);
        }
    }
}