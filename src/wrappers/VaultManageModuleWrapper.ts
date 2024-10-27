import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address, Uint256, Bytes } from '../utils/types';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';

export default class VaultManageModuleWrapper {
    private signer: Signer;
    private contracts: ContractWrapper;
    private VaultManageModuleAddress: Address;

    public constructor(signer: Signer, VaultManageModuleAddress: Address) {
        this.signer = signer;
        this.contracts = new ContractWrapper(this.signer);
        this.VaultManageModuleAddress = VaultManageModuleAddress;
    }

    public async removeVault(vault_addr: Address, encodeFunc?: boolean, txOpts: TransactionOverrides = {}): Promise<string | any> {
        try {
            const vaultManageModule = this.contracts.getVaultManageModule(this.VaultManageModuleAddress);
            if (encodeFunc) {
                return vaultManageModule.interface.encodeFunctionData('removeVault', vault_addr);
            }
            else {
                return await vaultManageModule.removeVault(vault_addr, txOpts);
            }
        }
        catch (error) {
            console.error('Error removeVault:', error);
        }
    }

    public async validVaultModuleV2(module_addr: Address, value: Uint256, func: Bytes) {
        try {
            const vaultManageModule = this.contracts.getVaultManageModule(this.VaultManageModuleAddress);
            return await vaultManageModule.validVaultModuleV2(module_addr, value, func);
        }
        catch (error) {
            console.error('Error validVaultModuleV2:', error);
        }
    }

    public async validVaultModule(module_addr: Address, arg1: Uint256, func: Bytes) {
        try {
            const vaultManageModule = this.contracts.getVaultManageModule(this.VaultManageModuleAddress);
            return await vaultManageModule.validVaultModule(module_addr, arg1, func);
        }
        catch (error) {
            console.error('Error validVaultModule:', error);
        }
    }

    public async registToPlatform(vault_addr: Address, salt: Uint256, txOpts: TransactionOverrides = {}): Promise<any> {
        try {
            const vaultManageModule = this.contracts.getVaultManageModule(this.VaultManageModuleAddress);
            return await vaultManageModule.registToPlatform(vault_addr, salt, txOpts);
        }
        catch (error) {
            console.error('Error initializing extension:', error);
        }
    }

    public async setVaultMasterToken(vault_addr: Address, masterToken_addr: Address, encodeFunc?: boolean,
        txOpts: TransactionOverrides = {}
    ): Promise<string | any> {
        try {
            const vaultManageModule = this.contracts.getVaultManageModule(this.VaultManageModuleAddress);
            if (encodeFunc) {
                return vaultManageModule.interface.encodeFunctionData('setVaultMasterToken', [vault_addr, masterToken_addr]);
            }
            else {
                return await vaultManageModule.setVaultMasterToken(vault_addr, masterToken_addr, txOpts);
            }
        }
        catch (error) {
            console.error('Error setVaultMasterToken:', error);
        }
    }

    public async setVaultProtocol(vault_addr: Address, protocols_addr: Address[], status: boolean[],
        encodeFunc?: boolean,
        txOpts: TransactionOverrides = {}
    ): Promise<string | any> {
        try {
            const vaultManageModule = this.contracts.getVaultManageModule(this.VaultManageModuleAddress);
            if (encodeFunc) {
                return vaultManageModule.interface.encodeFunctionData('setVaultProtocol', [vault_addr, protocols_addr, status]);
            }
            else {
                return await vaultManageModule.setVaultProtocol(vault_addr, protocols_addr, status, txOpts);
            }
        }
        catch (error) {
            console.error('Error setVaultProtocol:', error);
        }
    }

    public async setVaultTokens(vault_addr: Address, tokens_addr: Address[], types: Uint256[], encodeFunc?: boolean,
        txOpts: TransactionOverrides = {}

    ): Promise<string | any> {
        try {
            const vaultManageModule = this.contracts.getVaultManageModule(this.VaultManageModuleAddress);
            if (encodeFunc) {
                return vaultManageModule.interface.encodeFunctionData('setVaultTokens', [vault_addr, tokens_addr, types]);
            }
            else {
                return await vaultManageModule.setVaultTokens(vault_addr, tokens_addr, types, txOpts);
            }
        }
        catch (error) {
            console.error('Error setVaultTokens:', error);
        }
    }

    public async setVaultModule(vault_addr: Address, modules_addr: Address[], status: boolean[], encodeFunc?: boolean,
        txOpts: TransactionOverrides = {}

    ): Promise<string | any> {
        try {
            const vaultManageModule = this.contracts.getVaultManageModule(this.VaultManageModuleAddress);
            if (encodeFunc) {
                return vaultManageModule.interface.encodeFunctionData('setVaultModule', [vault_addr, modules_addr, status]);
            }
            else {
                return await vaultManageModule.setVaultModule(vault_addr, modules_addr, status, txOpts);
            }
        }
        catch (error) {
            console.error('Error initializing extension:', error);
        }
    }

    public async setVaultType(vault_addr: Address, vault_type: number, encodeFunc?: boolean, txOpts: TransactionOverrides = {}
    ): Promise<string | any> {
        try {
            const vaultManageModule = this.contracts.getVaultManageModule(this.VaultManageModuleAddress);
            if (encodeFunc) {
                return vaultManageModule.interface.encodeFunctionData('setVaultType', [vault_addr, vault_type]);
            }
            else {
                return await vaultManageModule.setVaultType(vault_addr, vault_type, txOpts);
            }
        }
        catch (error) {
            console.error('Error setVaultType:', error);
        }
    }


}