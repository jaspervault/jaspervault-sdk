import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address, Bytes } from '../utils/types';

export default class ManagerWrapper {
    private signer: Signer;
    private contracts: ContractWrapper;
    private ManagerAddress: Address;
    public constructor(signer: Signer, ManagerAddress: Address) {
        this.signer = signer;
        this.contracts = new ContractWrapper(this.signer);
        this.ManagerAddress = ManagerAddress;
    }

    public async multiCall(targets: Address[], data: Bytes[], encodeFunc?: boolean) {
        const Manager = this.contracts.getManager(this.ManagerAddress);
        try {
            if (encodeFunc) {
                return Manager.interface.encodeFunctionData('multiCall', [targets, data]);
            }
            else {
                return await Manager.multiCall(targets, data);
            }
        }
        catch (error) {
            console.error('Error Manager multiCall:', error);
        }
    }

    public async getVaultLock(vault: Address, encodeFunc?: boolean) {
        const Manager = this.contracts.getManager(this.ManagerAddress);
        if (encodeFunc) {
            return Manager.interface.encodeFunctionData('getVaultLock', [vault]);
        }
        else {
            try {
                return await Manager.getVaultLock(vault);
            }
            catch (error) {
                console.error('Error getVaultLock:', error);
            }
        }
    }

    public async getVaultAllModules(vault: Address, encodeFunc?: boolean) {
        const Manager = this.contracts.getManager(this.ManagerAddress);
        if (encodeFunc) {
            return Manager.interface.encodeFunctionData('getVaultAllModules', [vault]);
        }
        else {
            try {
                return await Manager.getVaultAllModules(vault);
            }
            catch (error) {
                console.error('Error getVaultAllModules:', error);
            }
        }
    }

    public async getVaultMasterToken(vault: Address, encodeFunc?: boolean) {
        const Manager = this.contracts.getManager(this.ManagerAddress);
        if (encodeFunc) {
            return Manager.interface.encodeFunctionData('getVaultMasterToken', [vault]);
        }
        else {
            try {
                return await Manager.getVaultMasterToken(vault);
            }
            catch (error) {
                console.error('Error getVaultMasterToken:', error);
            }
        }
    }

    public async getVaultAllTokens(vault: Address, encodeFunc?: boolean) {
        const Manager = this.contracts.getManager(this.ManagerAddress);
        if (encodeFunc) {
            return Manager.interface.encodeFunctionData('getVaultAllTokens', [vault]);
        }
        else {
            try {
                return await Manager.getVaultAllTokens(vault);
            }
            catch (error) {
                console.error('Error getVaultAllTokens:', error);
            }
        }
    }

    public async getVaultType(vault: Address, encodeFunc?: boolean) {
        const Manager = this.contracts.getManager(this.ManagerAddress);
        if (encodeFunc) {
            return Manager.interface.encodeFunctionData('getVaultType', [vault]);
        }
        else {
            try {
                return await Manager.getVaultType(vault);
            }
            catch (error) {
                console.error('Error getVaultType:', error);
            }
        }
    }

    public async getVaultModuleStatus(vault: Address, moduleAddr: Address, encodeFunc?: boolean) {
        const Manager = this.contracts.getManager(this.ManagerAddress);
        if (encodeFunc) {
            return Manager.interface.encodeFunctionData('getVaultModuleStatus', [vault, moduleAddr]);
        }
        else {
            try {
                return await Manager.getVaultModuleStatus(vault, moduleAddr);
            }
            catch (error) {
                console.error('Error getVaultModuleStatus:', error);
            }
        }
    }


    public getManagerContract() {
        return this.contracts.getManager(this.ManagerAddress);
    }
}