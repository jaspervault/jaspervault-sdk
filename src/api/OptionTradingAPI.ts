'use strict';
import { JVaultConfig, BundlerOP, SignedPrice, LiquidateType, OptionType, Address } from '../utils/types/index';
import { JVaultOrder, OptionOrder, Bytes } from '../utils/types';
import {
    OptionModuleV2Wrapper,
    PriceOracleWrapper,
    OptionServiceWrapper,
    VaultManageModuleWrapper,
    IssuanceModuleWrapper,
    VaultFactoryWrapper,
    ManagerWrapper,
    ERC20Wrapper
} from '../wrappers/';
import { IOptionModuleV2 } from '@jaspervault/contracts-v2/dist/types/typechain/contracts/modules/OptionModuleV2';
import { BigNumber, ethers } from 'ethers';
import axios from 'axios';
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';
import optionWriterConfig from '../utils/degen_writer.json';
import ADDRESSES from '../utils/coreAssets.json';
import { TransactionHandler, JaspervaultTransactionHandler } from '../utils/JaspervaultTransactionHandler';
interface VaultResult {
    bundlerOP: BundlerOP[];
    vaultAddress: string;
}
export default class OptionTradingAPI {
    private jVaultConfig: JVaultConfig;
    private OptionModuleV2Wrapper: OptionModuleV2Wrapper;
    private PriceOracleWrapper: PriceOracleWrapper;
    private OptionServiceWrapper: OptionServiceWrapper;
    private VaultManageModuleWrapper: VaultManageModuleWrapper;
    private IssuanceModuleWrapper: IssuanceModuleWrapper;
    private VaultFactoryWrapper: VaultFactoryWrapper;
    private ManagerWrapper: ManagerWrapper;
    private TransactionHandler: TransactionHandler;

    public constructor(
        config: JVaultConfig
    ) {
        this.jVaultConfig = config;
        this.OptionModuleV2Wrapper = new OptionModuleV2Wrapper(config.ethersSigner, config.data.contractData.OptionModuleV2);
        this.PriceOracleWrapper = new PriceOracleWrapper(config.ethersSigner, config.data.contractData.PriceOracle);
        this.OptionServiceWrapper = new OptionServiceWrapper(config.ethersSigner, config.data.contractData.OptionService);
        this.VaultManageModuleWrapper = new VaultManageModuleWrapper(config.ethersSigner, config.data.contractData.VaultManageModule);
        this.IssuanceModuleWrapper = new IssuanceModuleWrapper(config.ethersSigner, config.data.contractData.IssuanceModule);
        this.VaultFactoryWrapper = new VaultFactoryWrapper(config.ethersSigner, config.data.contractData.VaultFactory);
        this.ManagerWrapper = new ManagerWrapper(config.ethersSigner, config.data.contractData.Manager);
        if (this.jVaultConfig.transactionHandler == undefined) {
            this.TransactionHandler = new JaspervaultTransactionHandler(this.jVaultConfig);
        }
        else {
            this.TransactionHandler = this.jVaultConfig.transactionHandler;
        }
    }
    public async getTransactionHandler() {
        return this.TransactionHandler;
    }
    public async fetchSignData(JVaultOrder: JVaultOrder): Promise<SignedPrice> {
        const data = {
            'amount': JVaultOrder.amount,
            'jvault_product': 'Degen',
            'base_asset': this.getTokenNamebyAddress(JVaultOrder.underlyingAsset, this.jVaultConfig.network),
            'quote_asset': this.jVaultConfig.data.quoteAsset,
            'premium_asset': this.getTokenNamebyAddress(JVaultOrder.premiumAsset, this.jVaultConfig.network),
            'product_type': JVaultOrder.secondsToExpiry,
            'option_type': JVaultOrder.optionType == 0 ? 'C' : 'P',
            'option_mode': 'EUO',
            'chain_id': JVaultOrder.chainId,
        };
        try {
            const response = await axios.post(this.jVaultConfig.data.optionQuotesUrl, data);
            if (response.status == 200) {
                const data: SignedPrice = {
                    id: response.data.data.id,
                    chain_id: response.data.data.chain_id,
                    product_type: response.data.data.product_type,
                    option_asset: response.data.data.option_asset,
                    strike_price: response.data.data.strike_price,
                    strike_asset: response.data.data.strike_asset,
                    strike_amount: response.data.data.strike_amount,
                    lock_asset: response.data.data.lock_asset,
                    lock_amount: response.data.data.lock_amount,
                    expire_date: response.data.data.expire_date,
                    lock_date: response.data.data.lock_date,
                    option_type: response.data.data.option_type,
                    premium_asset: response.data.data.premium_asset,
                    premium_fee: response.data.data.premium_fee,
                    timestamp: response.data.data.timestamp,
                    oracle_sign: response.data.oracle_sign,
                };
                return data;
            }
        } catch (error) {
            console.error('Error making fetchSignData request:', error);
            throw error;
        }
    }

    public async createOrder(
        JVaultOrder: JVaultOrder,
        txOpts: TransactionOverrides = {}
    ) {
        const calldata_arr: BundlerOP[] = [];
        const newVaultResult = await this.checkAccount(JVaultOrder);
        calldata_arr.push(...newVaultResult.bundlerOP);
        JVaultOrder.optionVault = newVaultResult.vaultAddress;
        const depositPremiumOP = await this.depositPremium(JVaultOrder);
        if (depositPremiumOP.length > 0) {
            calldata_arr.push(...depositPremiumOP);
        }
        if (this.jVaultConfig.data.pythPriceFeedAddr != '') {
            calldata_arr.push(...await this.setPrice([]));
        }
        calldata_arr.push(...await this.submitOrder(JVaultOrder));
        try {
            return await this.TransactionHandler.sendTransaction(JVaultOrder.premiumVault, calldata_arr, txOpts);
            //   return await this.bundlerHelper.sendtoVault(JVaultOrder.premiumVault, calldata_arr, txOpts);
        }
        catch (error) {
            // console.error('Error Placing order:', error);
        }
    }

    public async checkVaultModulesStatus(vaultAddress: Address): Promise<boolean> {
        const targets: Address[] = [];
        const data: Bytes[] = [];
        const managerContract = this.ManagerWrapper.getManagerContract();
        const getActiveModules = this.getActiveModulesOfVault();

        for (let i = 0; i < getActiveModules.length; i++) {
            targets.push(managerContract.address);
            data.push(await this.ManagerWrapper.getVaultModuleStatus(vaultAddress, getActiveModules[i], true));
        }
        const result = await this.ManagerWrapper.multiCall(targets, data);
        for (let i = 0; i < result.length; i++) {
            const status = managerContract.interface.decodeFunctionResult('getVaultModuleStatus', result[i])[0];
            // console.log('module  --> status:', getActiveModules[i], status);
            if (status == false) {
                return false;
            }
        }
        return true;
    }

    private async checkAccount(JVaultOrder: JVaultOrder): Promise<VaultResult> {
        const calldata_arr: BundlerOP[] = [];
        let vaultAddress = ethers.constants.AddressZero;
        let code = await this.jVaultConfig.ethersProvider.getCode(JVaultOrder.premiumVault);
        if (code == '0x') {
            console.error('premiumVault has not been created');
            throw new Error('premiumVault has not been created');
            // calldata_arr.push(...await this.initializeVault(JVaultOrder.premiumVault, 1));
            // calldata_arr.push({
            //     dest: this.jVaultConfig.data.contractData.VaultFactory,
            //     value: ethers.constants.Zero,
            //     data: await this.VaultFactoryWrapper.createAccount(this.jVaultConfig.EOA, 1, true),
            // });
        }
        else {
            console.log('premiumVault checkVaultModulesStatus');
            calldata_arr.push(...await this.initializeVault(JVaultOrder.premiumVault, 1, !await this.checkVaultModulesStatus(JVaultOrder.premiumVault)));
        }
        if (JVaultOrder.optionVault != ethers.constants.AddressZero) {
            if (JVaultOrder.optionVault) {
                code = await this.jVaultConfig.ethersProvider.getCode(JVaultOrder.optionVault);
                if (code == '0x') {
                    const index = await this.VaultFactoryWrapper.getVaultToSalt(JVaultOrder.optionVault);
                    vaultAddress = await this.VaultFactoryWrapper.getAddress(this.jVaultConfig.EOA, index);
                    calldata_arr.push({
                        dest: this.jVaultConfig.data.contractData.VaultFactory,
                        value: ethers.constants.Zero,
                        data: await this.VaultFactoryWrapper.createAccount(this.jVaultConfig.EOA, index, true),
                    });
                    calldata_arr.push(...await this.initializeVault(JVaultOrder.optionVault, JVaultOrder.optionType == OptionType.CALL ? 7 : 3));
                }
                else {
                    calldata_arr.push(...await this.initializeVault(JVaultOrder.optionVault, JVaultOrder.optionType == OptionType.CALL ? 7 : 3));
                }
            }
        }
        else {
            const maxVaultSalt = await this.VaultFactoryWrapper.getVaultMaxSalt(this.jVaultConfig.EOA);
            let newVaultIndex = maxVaultSalt.add(1);
            if (maxVaultSalt.eq(0) || maxVaultSalt.eq(1)) {
                newVaultIndex = BigNumber.from(2);
            }
            vaultAddress = await this.VaultFactoryWrapper.getAddress(this.jVaultConfig.EOA, newVaultIndex);
            calldata_arr.push({
                dest: this.jVaultConfig.data.contractData.VaultFactory,
                value: ethers.constants.Zero,
                data: await this.VaultFactoryWrapper.createAccount(this.jVaultConfig.EOA, newVaultIndex, true),
            });
            calldata_arr.push(...await this.initializeVault(vaultAddress, JVaultOrder.optionType == OptionType.CALL ? 7 : 3));
        }
        return { bundlerOP: calldata_arr, vaultAddress: vaultAddress };
    }

    public async getOptionWriterSettings(): Promise<any> {
        return optionWriterConfig;
    }

    private async initializeVault(vaultAddress: Address, vaultType: number, moduleCheck: boolean = true, tokenCheck: boolean = true): Promise<BundlerOP[]> {
        const calldata_arr: BundlerOP[] = [];
        const vault_0 = await this.VaultFactoryWrapper.getAddress(this.jVaultConfig.EOA, 0);
        const contractData = this.jVaultConfig.data.contractData;
        if (moduleCheck) {
            const modules = this.getActiveModulesOfVault();
            const modulesStatus = [true, true, true, true, true, true, true];
            calldata_arr.push({
                dest: contractData.VaultManageModule,
                value: ethers.constants.Zero,
                data: await this.VaultManageModuleWrapper.setVaultModule(vaultAddress, modules, modulesStatus, true),
            });
        }
        if (vault_0.toLowerCase() != vaultAddress.toLowerCase() || vaultType != 1) {
            calldata_arr.push({
                dest: contractData.VaultManageModule,
                value: ethers.constants.Zero,
                data: await this.VaultManageModuleWrapper.setVaultType(vaultAddress, vaultType, true),
            });
        }
        // set vault Token
        if (tokenCheck) {
            const tokens = this.jVaultConfig.data.tokens.map(token => token.address);
            const tokens_types = this.jVaultConfig.data.tokens.map(token => BigNumber.from(token.type));
            calldata_arr.push({
                dest: contractData.VaultManageModule,
                value: ethers.constants.Zero,
                data: await this.VaultManageModuleWrapper.setVaultTokens(vaultAddress, tokens, tokens_types, true),
            });
        }
        return calldata_arr;

    }

    private async setPrice(priceIds: string[]) {
        const calldata_arr: BundlerOP[] = [];
        if (priceIds.length == 0) {
            for (let i = 0; i < this.jVaultConfig.data.pyth.length; i++) {
                priceIds.push(this.jVaultConfig.data.pyth[i][0]);
            }
        }
        const priceFeedUpdateData = await this.getPythPriceFeedUpdateData(priceIds);
        calldata_arr.push({
            dest: this.jVaultConfig.data.contractData.PriceOracle,
            value: ethers.constants.Zero,
            data: await this.PriceOracleWrapper.setPrice(this.jVaultConfig.data.pythPriceFeedAddr, priceFeedUpdateData, true),
        });
        return calldata_arr;
    }

    private async submitOrder(JVaultOrder: JVaultOrder): Promise<BundlerOP[]> {
        const calldata_arr: BundlerOP[] = [];
        const signedData: SignedPrice = await this.fetchSignData(JVaultOrder);
        console.log('signedData:', signedData);
        const premiumSign: IOptionModuleV2.PremiumOracleSignStruct = {
            id: signedData.id,
            chainId: signedData.chain_id,
            productType: signedData.product_type,
            optionAsset: signedData.option_asset,
            strikePrice: BigNumber.from(signedData.strike_price),
            strikeAsset: signedData.strike_asset,
            strikeAmount: BigNumber.from(signedData.strike_amount),
            lockAsset: signedData.lock_asset,
            lockAmount: BigNumber.from(signedData.lock_amount),
            expireDate: BigNumber.from(signedData.expire_date),
            lockDate: BigNumber.from(signedData.lock_date),
            optionType: BigNumber.from(signedData.option_type),
            premiumAsset: signedData.premium_asset,
            premiumFee: BigNumber.from(signedData.premium_fee),
            timestamp: BigNumber.from(signedData.timestamp),
            oracleSign: signedData.oracle_sign,
        };
        const writer_config = await this.OptionModuleV2Wrapper.getManagedOptionsSettings(JVaultOrder.optionWriter);
        let productTypeIndex = BigNumber.from(0);
        let settingsIndex = BigNumber.from(0);
        for (let i = 0; i < writer_config.length; i++) {
            for (let j = 0; j < writer_config[i].productTypes.length; j++) {
                if (writer_config[i].underlyingAsset == JVaultOrder.underlyingAsset) {
                    if (BigNumber.from(JVaultOrder.secondsToExpiry).eq(writer_config[i].productTypes[j])) {
                        productTypeIndex = BigNumber.from(j);
                        settingsIndex = BigNumber.from(i);
                        break;
                    }
                }
            }
        }
        const optionOrder: IOptionModuleV2.ManagedOrderStruct = {
            holder: JVaultOrder.optionVault,
            writer: JVaultOrder.optionWriter,
            recipient: JVaultOrder.premiumVault,
            quantity: BigNumber.from(JVaultOrder.amount),
            productTypeIndex: productTypeIndex,
            settingsIndex: settingsIndex,
            //  oracleIndex: this.jVaultConfig.data.pythPriceFeedAddr == '' ? BigNumber.from(1) : BigNumber.from(0),
            oracleIndex: BigNumber.from(0),
            premiumSign: premiumSign,
            nftFreeOption: ethers.constants.AddressZero,
        };
        console.log('optionOrder:', optionOrder);
        calldata_arr.push({
            dest: this.jVaultConfig.data.contractData.OptionModuleV2,
            value: ethers.constants.Zero,
            data: await this.OptionModuleV2Wrapper.SubmitManagedOrder(optionOrder, true),
        });
        return calldata_arr;
    }

    private async depositPremium(JVaultOrder: JVaultOrder): Promise<BundlerOP[]> {
        const calldata_arr: BundlerOP[] = [];
        if (JVaultOrder.amount.eq(BigNumber.from(0)) == false) {
            const signedData: SignedPrice = await this.fetchSignData(JVaultOrder);
            const premium = BigNumber.from(signedData.premium_fee).mul(BigNumber.from(JVaultOrder.amount)).div(ethers.constants.WeiPerEther);
            console.log('premium:', premium.toString());
            let vaule = ethers.constants.Zero;
            if (JVaultOrder.premiumAsset == this.jVaultConfig.data.eth) {
                vaule = premium;
            }
            let balanceOfPremiumVault: BigNumber = ethers.constants.Zero;
            if (JVaultOrder.premiumAsset == this.jVaultConfig.data.eth) {
                balanceOfPremiumVault = await this.jVaultConfig.ethersProvider.getBalance(JVaultOrder.premiumVault);
            }
            else {
                const premium_asset = new ERC20Wrapper(this.jVaultConfig.ethersSigner, JVaultOrder.premiumAsset);
                balanceOfPremiumVault = await premium_asset.balanceOf(JVaultOrder.premiumVault);
            }
            if (balanceOfPremiumVault.lt(premium) == true) {
                const transferAmount = premium.sub(balanceOfPremiumVault).mul(BigNumber.from(101)).div(BigNumber.from(100));
                console.log('transferAmount:', transferAmount.toString());
                let EOA_balance = ethers.constants.Zero;
                if (JVaultOrder.premiumAsset == this.jVaultConfig.data.eth) {
                    EOA_balance = await this.jVaultConfig.ethersProvider.getBalance(this.jVaultConfig.EOA);
                }
                else {
                    const premium_asset = new ERC20Wrapper(this.jVaultConfig.ethersSigner, JVaultOrder.premiumAsset);
                    EOA_balance = await premium_asset.balanceOf(this.jVaultConfig.EOA);
                    console.log(this.jVaultConfig.EOA);
                }
                console.log('EOA_balance:', JVaultOrder.premiumAsset, EOA_balance.toString());
                if (EOA_balance.gte(transferAmount) == true) {
                    if (JVaultOrder.premiumAsset != this.jVaultConfig.data.eth) {
                        const premium_asset = new ERC20Wrapper(this.jVaultConfig.ethersSigner, JVaultOrder.premiumAsset);
                        const allowance = await premium_asset.allowance(this.jVaultConfig.EOA, JVaultOrder.premiumVault);
                        if (allowance.lt(transferAmount)) {
                            console.log('approve:', transferAmount.toString());
                            await (await premium_asset.approve(JVaultOrder.premiumVault, transferAmount)).wait(this.jVaultConfig.data.safeBlock);
                        }
                        calldata_arr.push({
                            dest: this.jVaultConfig.data.contractData.IssuanceModule,
                            value: vaule,
                            data: await this.IssuanceModuleWrapper.issue(JVaultOrder.premiumVault, this.jVaultConfig.EOA, [JVaultOrder.premiumAsset], [transferAmount], true),
                        });
                    }
                }
                else {
                    throw new Error(`EOA_balance premiumAsset :${EOA_balance} Insufficient balance`);
                }
            }
            else {
                console.log('No need to deposit');
            }
        }
        return calldata_arr;
    }

    public getActiveModulesOfVault(): string[] {
        const contractData = this.jVaultConfig.data.contractData;
        return [
            contractData.VaultFactory,
            contractData.VaultManageModule,
            contractData.OptionModuleV2,
            contractData.IssuanceModule,
            contractData.PriceOracle,
            contractData.OptionService,
            contractData.VaultPaymaster,
        ];
    }

    public async liquidateOrder(
        JVaultOrder: JVaultOrder,
        liquidateType: LiquidateType,
        txOpts: TransactionOverrides = {}
    ) {
        const calldata_arr: BundlerOP[] = [];
        const priceIds = [];
        for (let i = 0; i < this.jVaultConfig.data.pyth.length; i++) {
            priceIds.push(this.jVaultConfig.data.pyth[i][0]);
        }
        const priceFeedUpdateData = await this.getPythPriceFeedUpdateData(priceIds);
        calldata_arr.push({
            dest: this.jVaultConfig.data.contractData.PriceOracle,
            value: ethers.constants.Zero,
            data: await this.PriceOracleWrapper.setPrice(this.jVaultConfig.data.pythPriceFeedAddr, priceFeedUpdateData, true),
        });
        let earnings = 0;
        if (liquidateType != 0) {
            earnings = await this.OptionServiceWrapper.getEarningsAmount(
                JVaultOrder.lockAsset,
                JVaultOrder.lockAmount,
                JVaultOrder.strikeAsset,
                JVaultOrder.strikeAmount);
        }
        console.log('Earnings:', earnings);
        calldata_arr.push({
            dest: this.jVaultConfig.data.contractData.OptionService,
            value: ethers.constants.Zero,
            data: await this.OptionServiceWrapper.liquidateOption(
                BigNumber.from(JVaultOrder.optionType),
                BigNumber.from(JVaultOrder.id),
                BigNumber.from(liquidateType),
                BigNumber.from(earnings),
                ethers.constants.Zero,
                true),
        });
        try {
            return await this.TransactionHandler.sendTransaction(JVaultOrder.premiumVault, calldata_arr, txOpts);
        }
        catch (error) {
            console.error('Error liquidateOrder:', error);
        }
    }

    public async getOrderByHash(transactionHash: string): Promise<OptionOrder> {
        const query = `
        query OptionPremium {
    optionPremiums(where: { transactionHash: "${transactionHash}" }) {
        id
        orderType
        orderID
        writer
        holder
        premiumAsset
        amount
        transactionHash
        timestamp
    }
}
    `;
        try {
            const response = await axios.post(this.jVaultConfig.data.subgraphUrl, {
                query: query,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const optionPremiums = response.data.data.optionPremiums[0];
            if (!optionPremiums) {
                return undefined;
            }
            if (optionPremiums.orderType == 0) {
                const order_query = `
                query CallOrderEntity {
    callOrderEntityV2S(where: { orderId: "${optionPremiums.orderID}" }) {
        id
        orderId
        holderWallet
        writerWallet
        transactionHash
        timestamp
        callOrder {
            id
            holder
            liquidateMode
            writer
            lockAssetType
            recipient
            lockAsset
            underlyingAsset
            strikeAsset
            lockAmount
            strikeAmount
            expirationDate
            lockDate
            underlyingNftID
            quantity
        }
    }
}
                `;
                const response_callorder = await axios.post(this.jVaultConfig.data.subgraphUrl, {
                    query: order_query,
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                const orderData = response_callorder.data.data.callOrderEntityV2S[0];
                if (!orderData) {
                    return undefined;
                }
                const order: OptionOrder = {
                    transactionHash: orderData.transactionHash,
                    timestamp: orderData.timestamp,
                    orderDetail: orderData.callOrder || undefined,
                    orderId: orderData.orderId,
                    holderWallet: orderData.holderWallet,
                    writerWallet: orderData.writerWallet,
                };
                return order;
            }
            else {
                const order_query = `
                query PutOrderEntity {
    putOrderEntityV2S(where: { orderId: "${optionPremiums.orderID}" }) {
        id
        orderId
        holderWallet
        writerWallet
        transactionHash
        timestamp
        putOrder {
            id
            holder
            liquidateMode
            writer
            lockAssetType
            recipient
            lockAsset
            underlyingAsset
            strikeAsset
            lockAmount
            strikeAmount
            expirationDate
            lockDate
            underlyingNftID
            quantity
        }
    }
}
                `;
                const response_putorder = await axios.post(this.jVaultConfig.data.subgraphUrl, {
                    query: order_query,
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                const orderData = response_putorder.data.data.putOrderEntityV2S[0];
                if (!orderData) {
                    return undefined;
                }
                const order: OptionOrder = {
                    transactionHash: orderData.transactionHash,
                    timestamp: orderData.timestamp,
                    orderDetail: orderData.putOrder || undefined,
                    orderId: orderData.orderId,
                    holderWallet: orderData.holderWallet,
                    writerWallet: orderData.writerWallet,
                };
                return order;

            }
        } catch (error) {
            console.error('Error fetching order data:', error);
            return undefined;
        }
    }

    private async getPythPriceFeedUpdateData(tokens: string[]): Promise<any> {
        const connection = new EvmPriceServiceConnection('https://hermes.pyth.network');
        const priceFeedUpdateData = await connection.getPriceFeedsUpdateData(tokens);
        return priceFeedUpdateData;
    }

    private getTokenNamebyAddress(address: string, chain: string): string {
        const chainTokens = ADDRESSES[chain];
        if (!chainTokens) {
            console.error(`Chain ${chain} not found`);
            return undefined;
        }
        for (const [tokenName, tokenAddress] of Object.entries(chainTokens)) {
            if ((tokenAddress as string).toLowerCase() === address.toLowerCase()) {
                return tokenName;
            }
        }
        console.error(`Address ${address} not found on chain ${chain}`);
        return undefined;
    }
}