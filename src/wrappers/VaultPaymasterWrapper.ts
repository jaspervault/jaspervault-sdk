import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address } from '../utils/types';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';

export default class VaultPaymasterWrapper {
    private signer: Signer;
    private contracts: ContractWrapper;
    private VaultPaymasterAddress: Address;
    public constructor(signer: Signer, VaultPaymasterAddress: Address) {
        this.signer = signer;
        this.contracts = new ContractWrapper(this.signer);
        this.VaultPaymasterAddress = VaultPaymasterAddress;
    }
    public async depositEth(
        wallet: Address,
        txOpts: TransactionOverrides = {}
    ) {
        const VaultPaymaster = this.contracts.getVaultPaymaster(this.VaultPaymasterAddress);
        try {
            return await VaultPaymaster.depositEth(wallet, txOpts);
        }
        catch (error) {
            console.error('Error depositEth:', error);
        }
    }
    public async getWalletPaymasterBalance(
        wallet: Address
    ) {
        const VaultPaymaster = this.contracts.getVaultPaymaster(this.VaultPaymasterAddress);
        try {
            return VaultPaymaster.getWalletPaymasterBalance(wallet);
        }
        catch (error) {
            console.error('Error getWalletPaymasterBalance:', error);
        }
    }



}