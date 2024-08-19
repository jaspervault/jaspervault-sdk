import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address, TransactionOverrides } from '../utils/types';
import { IOptionModuleV2, IOptionFacetV2 } from '@jaspervault/contracts-v2/dist/types/typechain/contracts/modules/OptionModuleV2';

export default class OptionModuleV2Wrapper {
    private signer: Signer;
    private contracts: ContractWrapper;
    private OptionModuleV2Address: Address;

    public constructor(signer: Signer, optionModuleV2Address: Address) {
        this.signer = signer;
        this.contracts = new ContractWrapper(this.signer);
        this.OptionModuleV2Address = optionModuleV2Address;
    }
    public async setOptionService(optionsServicesAddress: Address, txOpts: TransactionOverrides = {}) {
        try {
            const optionModule = await this.contracts.getOptionModuleV2(this.OptionModuleV2Address);
            return optionModule.setOptionService(optionsServicesAddress, txOpts);
        }
        catch (error) {
            console.error('Error setOptionService:', error);
        }
    }

    public async SubmitManagedOrder(order: IOptionModuleV2.ManagedOrderStruct,
        encodeFunc?: boolean,
        txOpts: TransactionOverrides = {}): Promise<string | any> {
        try {
            const optionModule = await this.contracts.getOptionModuleV2(this.OptionModuleV2Address);
            if (encodeFunc) {
                return optionModule.interface.encodeFunctionData('SubmitManagedOrder', [order]);
            }
            else {
                return optionModule.SubmitManagedOrder(order, txOpts);
            }
        }
        catch (error) {
            console.error('Error SubmitOrder', error);
        }
    }


    public async setManagedOptionsSettings(
        settings: IOptionFacetV2.ManagedOptionsSettingsStruct,
        encodeFunc?: boolean,
        txOpts: TransactionOverrides = {}): Promise<string | any> {
        try {
            const optionModuleV2 = await this.contracts.getOptionModuleV2(this.OptionModuleV2Address);
            if (encodeFunc) {
                return optionModuleV2.interface.encodeFunctionData('setManagedOptionsSettings', [settings]);
            }
            else {
                return optionModuleV2.setManagedOptionsSettings(settings, txOpts);
            }
        }
        catch (error) {
            console.error('Error setManagedOptionsSettings:', error);
        }
    }

    public async getManagedOptionsSettings(vault: Address): Promise<IOptionFacetV2.ManagedOptionsSettingsStruct[]> {
        try {
            const optionModuleV2 = await this.contracts.getOptionModuleV2(this.OptionModuleV2Address);
            return optionModuleV2.getManagedOptionsSettings(vault);
        }
        catch (error) {
            console.error('Error getManagedOptionsSettings:', error);
        }
    }

}