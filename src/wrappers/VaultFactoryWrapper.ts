import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address } from '../utils/types';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';

export default class VaultFactoryWrapper {
  private signer: Signer;
  private contracts: ContractWrapper;
  private VaultFactoryAddress: Address;

  public constructor(signer: Signer, VaultFactoryAddress: Address) {
    this.signer = signer;
    this.contracts = new ContractWrapper(this.signer);
    this.VaultFactoryAddress = VaultFactoryAddress;
  }
  public async getWalletToVault(wallet: Address) {
    try {
      const vaultFactory = this.contracts.getVaultFactory(this.VaultFactoryAddress);
      return vaultFactory.getWalletToVault(wallet);
    } catch (error) {
      console.error('Error initializing extension:', error);
    }
  }
  public async getAddress(wallet: Address, index: number) {
    try {
      const vaultFactory = this.contracts.getVaultFactory(this.VaultFactoryAddress);
      return vaultFactory.getAddress(wallet, index);
    } catch (error) {
      console.error('Error getAddress:', error);
    }
  }
  public async getVaultToSalt(vault: Address) {
    try {
      const vaultFactory = this.contracts.getVaultFactory(this.VaultFactoryAddress);
      return vaultFactory.getVaultToSalt(vault);
    } catch (error) {
      console.error('Error getVaultToSalt:', error);
    }
  }
  public async getVaultMaxSalt(wallet: Address) {
    try {
      const vaultFactory = this.contracts.getVaultFactory(this.VaultFactoryAddress);
      return vaultFactory.getVaultMaxSalt(wallet);
    } catch (error) {
      console.error('Error getVaultMaxSalt:', error);
    }
  }
  public async createAccount(wallet: Address, salt: number, encodeFunc?: boolean, txOpts: TransactionOverrides = {}): Promise<string | any> {
    try {
      const vaultFactory = this.contracts.getVaultFactory(this.VaultFactoryAddress);
      if (encodeFunc) {
        return vaultFactory.interface.encodeFunctionData('createAccount', [wallet, salt]);
      } else {
        return await vaultFactory.createAccount(wallet, salt, txOpts);
      }
    } catch (error) {
      console.error('Error createAccount:', error);
    }
  }
}
