'use strict';
import { JVaultConfig, BundlerOP } from '../utils/types/index';
import { Address, TransactionOverrides } from '../utils/types';
import {
    VaultWrapper,
    VaultManageModuleWrapper,
    VaultFactoryWrapper,
    VaultPaymasterWrapper,
    IssuanceModuleWrapper,
    OptionModuleV2Wrapper
} from '../wrappers/';
import { BigNumber } from 'ethers/lib/ethers';
import { ethers } from 'ethers';
import BundlerHelper from '../utils/BundlerHelper';
import { IOptionFacetV2 } from '@jaspervault/contracts-v2/dist/types/typechain/contracts/modules/OptionModuleV2';

export default class OptionTradingAPI {
    private jVaultConfig: JVaultConfig;
    private bundlerHelper: BundlerHelper;
    private VaultManageModuleWrapper: VaultManageModuleWrapper;
    private VaultFactoryWrapper: VaultFactoryWrapper;
    private VaultPaymasterWrapper: VaultPaymasterWrapper;
    private IssuanceModuleWrapper: IssuanceModuleWrapper;
    private OptionModuleV2Wrapper: OptionModuleV2Wrapper;
    public constructor(
        config: JVaultConfig,
    ) {
        this.jVaultConfig = config;
        this.VaultManageModuleWrapper = new VaultManageModuleWrapper(config.ethersSigner, config.data.contractData.VaultManageModule);
        this.VaultFactoryWrapper = new VaultFactoryWrapper(config.ethersSigner, config.data.contractData.VaultFactory);
        this.VaultPaymasterWrapper = new VaultPaymasterWrapper(config.ethersSigner, config.data.contractData.VaultPaymaster);
        this.IssuanceModuleWrapper = new IssuanceModuleWrapper(config.ethersSigner, config.data.contractData.IssuanceModule);
        this.OptionModuleV2Wrapper = new OptionModuleV2Wrapper(config.ethersSigner, config.data.contractData.OptionModuleV2);
        this.bundlerHelper = new BundlerHelper(config);
    }

    public async initNewVault(
        type: number,
        txOpts: TransactionOverrides = {}
    ): Promise<string | any> {
        const contractData = this.jVaultConfig.data.contractData;
        const wallet = await this.jVaultConfig.ethersSigner.getAddress();
        const maxVaultSalt = await this.VaultFactoryWrapper.getVaultMaxSalt(wallet);
        const newVaultIndex = maxVaultSalt.add(1);
        const newVault = await this.VaultFactoryWrapper.getAddress(wallet, newVaultIndex);
        const vault1 = await this.VaultFactoryWrapper.getAddress(wallet, 1);
        const calldata_arr: BundlerOP[] = [];
        // calldata_arr.push({
        //     dest: this.jVaultConfig.data.contractData.VaultManageModule,
        //     value: ethers.constants.Zero,
        //     data: await this.VaultManageModuleWrapper.setVaultModule(vault1, [this.jVaultConfig.data.contractData.VaultFactory], [true], true),
        // });
        // return await this.bundlerHelper.sendtoVault(vault1, calldata_arr);

        calldata_arr.push({
            dest: this.jVaultConfig.data.contractData.VaultFactory,
            value: ethers.constants.Zero,
            data: await this.VaultFactoryWrapper.createAccount(wallet, newVaultIndex, true),
        });

        const initVault_calldata_arr: BundlerOP[] = [];
        const modules = [
            contractData.VaultPaymaster,
            contractData.VaultManageModule,
            contractData.IssuanceModule,
            contractData.OptionModuleV2,
            contractData.OptionService,
            contractData.PriceOracle];
        const modulesStatus = [true, true, true, true, true, true];
        initVault_calldata_arr.push({
            dest: contractData.VaultManageModule,
            value: ethers.constants.Zero,
            data: await this.VaultManageModuleWrapper.setVaultModule(newVault, modules, modulesStatus, true),
        });
        // set vaultType
        initVault_calldata_arr.push({
            dest: contractData.VaultManageModule,
            value: ethers.constants.Zero,
            data: await this.VaultManageModuleWrapper.setVaultType(newVault, type, true),
        });
        // set vault Token

        const tokens = this.jVaultConfig.data.tokens.map(token => token.address);
        const tokens_types = this.jVaultConfig.data.tokens.map(token => BigNumber.from(token.type));
        initVault_calldata_arr.push({
            dest: contractData.VaultManageModule,
            value: ethers.constants.Zero,
            data: await this.VaultManageModuleWrapper.setVaultTokens(newVault, tokens, tokens_types, true),
        });
        const dest = [];
        const value = [];
        const func = [];
        initVault_calldata_arr.forEach(element => {
            dest.push(element.dest);
            value.push(element.value);
            func.push(element.data);
        });
        const Vault = new VaultWrapper(this.jVaultConfig.ethersSigner, newVault);
        calldata_arr.push({
            dest: newVault,
            value: ethers.constants.Zero,
            data: await Vault.executeBatch(dest, value, func, true),
        });
        return await this.bundlerHelper.sendtoVault(vault1, calldata_arr, txOpts);

        // const createAccountTX = await this.VaultFactoryWrapper.createAccount(wallet, newVaultIndex);
        // if (createAccountTX) {
        //     await createAccountTX.wait(2);
        //     await (await this.initVault(newVault, type)).wait(2);
        //     return newVault;
        // }
        // else {
        //     console.error('Error creating account:', createAccountTX);
        //     return ethers.constants.AddressZero;
        // }
    }

    public async initVault(
        vault_addr: Address,
        type: number,
        txOpts: TransactionOverrides = {}
    ): Promise<string | any> {
        try {
            const contractData = this.jVaultConfig.data.contractData;
            const calldata_arr: BundlerOP[] = [];
            const modules = [
                contractData.VaultPaymaster,
                contractData.VaultManageModule,
                contractData.IssuanceModule,
                contractData.OptionModuleV2,
                contractData.OptionService,
                contractData.PriceOracle];
            const modulesStatus = [true, true, true, true, true, true];
            // set moduleType
            console.log('Initializing vault:', vault_addr, type);
            calldata_arr.push({
                dest: contractData.VaultManageModule,
                value: ethers.constants.Zero,
                data: await this.VaultManageModuleWrapper.setVaultModule(vault_addr, modules, modulesStatus, true),
            });
            // set vaultType
            calldata_arr.push({
                dest: contractData.VaultManageModule,
                value: ethers.constants.Zero,
                data: await this.VaultManageModuleWrapper.setVaultType(vault_addr, type, true),
            });
            // set vault Token

            const tokens = this.jVaultConfig.data.tokens.map(token => token.address);
            const tokens_types = this.jVaultConfig.data.tokens.map(token => BigNumber.from(token.type));
            calldata_arr.push({
                dest: contractData.VaultManageModule,
                value: ethers.constants.Zero,
                data: await this.VaultManageModuleWrapper.setVaultTokens(vault_addr, tokens, tokens_types, true),
            });

            // console.log(calldata_arr);
            // const index = await this.VaultFactoryWrapper.getVaultToSalt(vault_addr);
            // await this.bundlerHelper.sendtoBundler(vault_addr, index, calldata_arr);
            return await this.bundlerHelper.sendtoVault(vault_addr, calldata_arr, txOpts);
        }
        catch (error) {
            console.error('Error initializing vault:', error);
        }
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
            const vault1 = await this.bundlerHelper.getSender(1);
            const user_wallet = await this.jVaultConfig.ethersSigner.getAddress();
            if (from == user_wallet) {
                return await this.IssuanceModuleWrapper.issue(to, user_wallet, asset, amount, txOpts);
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
            console.error('Error initializing extension:', error);
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
    public async setOptionWriterSettings(vault_addr: Address,
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
            return await this.bundlerHelper.sendtoVault(vault_addr, calldata_arr);
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