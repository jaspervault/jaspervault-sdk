'use strict';
import { JVaultConfig, BundlerOP } from '../utils/types/index';
import { Address, TransactionOverrides, JVaultStatus, Bytes } from '../utils/types';
import {
    VaultFactoryWrapper,
    VaultPaymasterWrapper,
    IssuanceModuleWrapper,
    OptionModuleV2Wrapper,
    ManagerWrapper,

} from '../wrappers/';
import { BigNumber } from 'ethers/lib/ethers';
import { ethers } from 'ethers';
import { IOptionFacetV2 } from '@jaspervault/contracts-v2/dist/types/typechain/contracts/modules/OptionModuleV2';
import { TransactionHandler, JaspervaultTransactionHandler } from '../utils/JaspervaultTransactionHandler';

export default class OptionTradingAPI {
    private jVaultConfig: JVaultConfig;
    private TransactionHandler: TransactionHandler;
    private VaultFactoryWrapper: VaultFactoryWrapper;
    private VaultPaymasterWrapper: VaultPaymasterWrapper;
    private IssuanceModuleWrapper: IssuanceModuleWrapper;
    private OptionModuleV2Wrapper: OptionModuleV2Wrapper;
    private ManagerWrapper: ManagerWrapper;

    public constructor(
        config: JVaultConfig,
    ) {
        this.jVaultConfig = config;
        this.VaultFactoryWrapper = new VaultFactoryWrapper(config.ethersSigner, config.data.contractData.VaultFactory);
        this.VaultPaymasterWrapper = new VaultPaymasterWrapper(config.ethersSigner, config.data.contractData.VaultPaymaster);
        this.IssuanceModuleWrapper = new IssuanceModuleWrapper(config.ethersSigner, config.data.contractData.IssuanceModule);
        this.OptionModuleV2Wrapper = new OptionModuleV2Wrapper(config.ethersSigner, config.data.contractData.OptionModuleV2);
        this.ManagerWrapper = new ManagerWrapper(config.ethersSigner, config.data.contractData.Manager);
        if (this.jVaultConfig.transactionHandler == undefined) {
            this.TransactionHandler = new JaspervaultTransactionHandler(this.jVaultConfig);
        }
        else {
            this.TransactionHandler = this.jVaultConfig.transactionHandler;
        }
    }

    /// <summary>
    /// Initialize a new account
    /// </summary>
    /// <returns>Vault 1 Address</returns>
    public async initNewAccount(): Promise<Address> {
        const vault1 = await this.VaultFactoryWrapper.getAddress(this.jVaultConfig.EOA, 1);
        const code = await this.jVaultConfig.ethersProvider.getCode(vault1);
        if (code == '0x') {
            const createAccountTX = await this.VaultFactoryWrapper.createAccount(this.jVaultConfig.EOA, 1);
            if (createAccountTX) {
                await createAccountTX.wait(this.jVaultConfig.data.safeBlock);

                return vault1;
            }
            else {
                console.error('Error creating account:', createAccountTX);
                return ethers.constants.AddressZero;
            }
        }
        return vault1;
    }



    public async transfer(
        from: Address,
        to: Address,
        asset: Address[],
        amount: BigNumber[],
        txOpts: TransactionOverrides = {}
    ): Promise<string | any> {
        try {
            const asset_type: BigNumber[] = [];
            for (let i = 0; i < asset.length; i++) {
                asset_type.push(BigNumber.from(1));
            }
            const vault1 = await this.initNewAccount();
            const user_wallet = await this.jVaultConfig.ethersSigner.getAddress();
            if (from == user_wallet) {
                return await this.IssuanceModuleWrapper.issue(to, user_wallet, asset, amount, false, txOpts);
            }
            else if (to == user_wallet) {
                return await this.IssuanceModuleWrapper.redeem(vault1, asset_type, asset, amount, txOpts);
            }

        } catch (error) {
            console.error('Error transfering vault:', error);
        }
    }

    public async getWalletToVault(wallet: Address) {
        try {
            return this.VaultFactoryWrapper.getWalletToVault(wallet);
        } catch (error) {
            console.error('Error getWalletToVault:', error);
        }
    }

    public async getVaultToSalt(vault: Address): Promise<number> {
        try {
            return await this.VaultFactoryWrapper.getVaultToSalt(vault);
        } catch (error) {
            console.error('Error getting vault to salt:', error);
        }
    }

    public async getAddress(wallet: Address, salt: number): Promise<Address> {
        try {
            return await this.VaultFactoryWrapper.getAddress(wallet, salt);
        } catch (error) {
            console.error('Error getting address:', error);
        }
    }

    public async depositToPaymaster(wallet: Address, amount: BigNumber) {
        try {

            await this.VaultPaymasterWrapper.depositEth(wallet, {
                value: amount,
            });
            return await this.VaultPaymasterWrapper.getWalletPaymasterBalance(wallet);


        } catch (error) {
            console.error('Error depositing to paymaster:', error);
        }
    }

    public async getVaultStatus(vault: Address): Promise<JVaultStatus> {
        try {
            const targets: Address[] = [];
            const data: Bytes[] = [];
            const managerContract = this.ManagerWrapper.getManagerContract();
            targets.push(this.jVaultConfig.data.contractData.Manager);
            data.push(await this.ManagerWrapper.getVaultLock(vault, true));

            targets.push(this.jVaultConfig.data.contractData.Manager);
            data.push(await this.ManagerWrapper.getVaultAllModules(vault, true));

            targets.push(this.jVaultConfig.data.contractData.Manager);
            data.push(await this.ManagerWrapper.getVaultAllTokens(vault, true));

            targets.push(this.jVaultConfig.data.contractData.Manager);
            data.push(await this.ManagerWrapper.getVaultType(vault, true));

            const result = await this.ManagerWrapper.multiCall(targets, data);
            return {
                isLocked: managerContract.interface.decodeFunctionResult('getVaultLock', result[0])[0],
                modules: managerContract.interface.decodeFunctionResult('getVaultAllModules', result[1])[0],
                tokens: managerContract.interface.decodeFunctionResult('getVaultAllTokens', result[2])[0],
                type: managerContract.interface.decodeFunctionResult('getVaultType', result[3])[0],
            };
        } catch (error) {
            console.error('Error getting vault status:', error);
        }
    }

    public async getWalletPaymasterBalance(wallet: Address) {
        try {
            return await this.VaultPaymasterWrapper.getWalletPaymasterBalance(wallet);
        } catch (error) {
            console.error('Error getting wallet paymaster balance:', error);
        }
    }

    public async createNewVault(wallet: Address, txOpts: TransactionOverrides = {}): Promise<Address> {
        try {
            const maxVaultSalt = await this.VaultFactoryWrapper.getVaultMaxSalt(wallet);
            const newVaultIndex = maxVaultSalt.add(1);
            const tx = await this.VaultFactoryWrapper.createAccount(wallet, newVaultIndex, false, txOpts);
            if (tx) {
                const newVault = await this.VaultFactoryWrapper.getAddress(wallet, newVaultIndex);
                await tx.wait(2);
                return newVault;
            }
            else {
                return ethers.constants.AddressZero;
            }
        } catch (error) {
            console.error('Error creating account:', error);
        }
    }
    public async createAccount(wallet: Address, index?: number, txOpts: TransactionOverrides = {}): Promise<Address> {
        try {
            if (!index) {
                const maxVaultSalt = await this.VaultFactoryWrapper.getVaultMaxSalt(wallet);
                const newVaultIndex = maxVaultSalt.add(1);
                index = newVaultIndex;
            }
            const tx = await this.VaultFactoryWrapper.createAccount(wallet, index, false, txOpts);
            if (tx) {
                const newVault = await this.VaultFactoryWrapper.getAddress(wallet, index);
                await tx.wait(2);
                return newVault;
            }
            else {
                return ethers.constants.AddressZero;
            }
        } catch (error) {
            console.error('Error creating account:', error);
        }
    }
    public async setOptionWriterSettings(
        settings: IOptionFacetV2.ManagedOptionsSettingsStruct,
        txOpts: TransactionOverrides = {}): Promise<string | any> {
        try {
            const contractData = this.jVaultConfig.data.contractData;
            const calldata_arr: BundlerOP[] = [];
            calldata_arr.push({
                dest: contractData.OptionModule,
                value: ethers.constants.Zero,
                data: await this.OptionModuleV2Wrapper.setManagedOptionsSettings(settings, true, txOpts),
            });
            const vault_1 = await this.initNewAccount();
            return await this.TransactionHandler.sendTransaction(vault_1, calldata_arr, txOpts);
        } catch (error) {
            console.error('Error setOptionWriterSettings:', error);
        }
    }
    public async getOptionWriterSettings(vault_addr: Address): Promise<IOptionFacetV2.ManagedOptionsSettingsStruct[]> {
        try {
            return await this.OptionModuleV2Wrapper.getManagedOptionsSettings(vault_addr);
        } catch (error) {
            console.error('Error getOptionWriterSettings:', error);
        }
    }

}