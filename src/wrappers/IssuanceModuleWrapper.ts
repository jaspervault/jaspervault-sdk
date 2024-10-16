import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address, Uint256 } from '../utils/types';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';

export default class IssuanceModuleWrapper {
    private signer: Signer;
    private contracts: ContractWrapper;
    private IssuanceModuleAddress: Address;

    public constructor(signer: Signer, issuanceModuleAddress: Address) {
        this.signer = signer;
        this.contracts = new ContractWrapper(this.signer);
        this.IssuanceModuleAddress = issuanceModuleAddress;
    }

    public async setProxyIssueWhiteList(vault_addr: Address,
        issuer_addr: Address,
        status: boolean,
        encodeFunc?: boolean,
        txOpts: TransactionOverrides = {}) {
        try {
            const issuanceModule = await this.contracts.getIssuanceModule(this.IssuanceModuleAddress);
            if (encodeFunc) {
                return issuanceModule.interface.encodeFunctionData('setProxyIssueWhiteList', [vault_addr, issuer_addr, status]);
            }
            else {
                return issuanceModule.setProxyIssueWhiteList(vault_addr, issuer_addr, status, txOpts);
            }
        }
        catch (error) {
            console.error('Error initializing extension:', error);
        }
    }

    public async getWhiteListAndMode(vault_addr: Address, issuer_addr: Address) {
        try {
            const issuanceModule = await this.contracts.getIssuanceModule(this.IssuanceModuleAddress);
            issuanceModule.getWhiteListAndMode(vault_addr, issuer_addr);
        }
        catch (error) {
            console.error('Error initializing extension:', error);
        }
    }

    public async issue(
        vault_addr: Address,
        payableFrom_addr: Address,
        assets: Address[],
        amounts: Uint256[],
        encodeFunc?: boolean,
        txOpts: TransactionOverrides = {}): Promise<any> {
        try {
            const issuanceModule = await this.contracts.getIssuanceModule(this.IssuanceModuleAddress);
            if (encodeFunc) {
                return issuanceModule.interface.encodeFunctionData('issue', [vault_addr, payableFrom_addr, assets, amounts]);
            }
            else {
                return issuanceModule.issue(vault_addr, payableFrom_addr, assets, amounts, txOpts);
            }
        }
        catch (error) {
            console.error('Error issue asset:', error);
        }
    }

    public async issueAndProxy(vault_addr: Address,
        assets_addr: Address[],
        amounts: Uint256[],
        txOpts: TransactionOverrides = {}) {
        try {
            const issuanceModule = await this.contracts.getIssuanceModule(this.IssuanceModuleAddress);
            return issuanceModule.issueAndProxy(vault_addr, assets_addr, amounts, txOpts);
        }
        catch (error) {
            console.error('Error initializing extension:', error);
        }
    }

    public async redeem(vault_addr: Address,
        assets_type: Uint256[], assets_addr: Address[], amounts: Uint256[], txOpts: TransactionOverrides = {}): Promise<any> {
        try {
            const issuanceModule = await this.contracts.getIssuanceModule(this.IssuanceModuleAddress);
            return issuanceModule.redeem(vault_addr, assets_type, assets_addr, amounts, txOpts);
        }
        catch (error) {
            console.error('Error initializing extension:', error);
        }
    }

    public async redeemProxy(vault_addr: Address,
        assets_type: Uint256[],
        assets_addr: Address[], amounts: Uint256[],
        txOpts: TransactionOverrides = {}) {
        try {
            const issuanceModule = await this.contracts.getIssuanceModule(this.IssuanceModuleAddress);
            issuanceModule.redeemProxy(vault_addr, assets_type, assets_addr, amounts, txOpts);
        }
        catch (error) {
            console.error('Error initializing extension:', error);
        }
    }
}
