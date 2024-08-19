import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address } from '../utils/types';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';

export default class OptionModuleWrapper {
    private signer: Signer;
    private contracts: ContractWrapper;
    private OptionModuleAddress: Address;

    public constructor(signer: Signer, optionModuleAddress: Address) {
        this.signer = signer;
        this.contracts = new ContractWrapper(this.signer);
        this.OptionModuleAddress = optionModuleAddress;
    }
    public async setOptionService(optionsServicesAddress: Address, txOpts: TransactionOverrides = {}) {
        try {
            const optionModule = this.contracts.getOptionModule(this.OptionModuleAddress);
            return await optionModule.setOptionService(optionsServicesAddress, txOpts);
        }
        catch (error) {
            console.error('Error setOptionService', error);
        }
    }



}