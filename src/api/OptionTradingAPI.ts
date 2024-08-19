'use strict';
import { JVaultConfig, BundlerOP, SignedPrice, LiquidateType, OptionType } from '../utils/types/index';
import { JVaultOrder, OptionOrder } from '../utils/types';
import {
    OptionModuleV2Wrapper,
    PriceOracleWrapper,
    OptionServiceWrapper,
    VaultManageModuleWrapper
} from '../wrappers/';
import { IOptionModuleV2 } from '@jaspervault/contracts-v2/dist/types/typechain/contracts/modules/OptionModuleV2';
import { BigNumber, ethers } from 'ethers';
import BundlerHelper from '../utils/BundlerHelper';
import axios from 'axios';
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';
import optionWriterConfig from '../utils/degen_writer.json';
import ADDRESSES from '../utils/coreAssets.json';

export default class OptionTradingAPI {
    private jVaultConfig: JVaultConfig;
    private bundlerHelper: BundlerHelper;
    private OptionModuleV2Wrapper: OptionModuleV2Wrapper;
    private PriceOracleWrapper: PriceOracleWrapper;
    private OptionServiceWrapper: OptionServiceWrapper;
    private VaultManageModuleWrapper: VaultManageModuleWrapper;
    private jVaultgraphQLEndpoint: string = 'https://gateway-arbitrum.network.thegraph.com/api/7ca317c1d6347234f75513585a71157c/subgraphs/id/HkE4i846HyUEbmBg7cTawRqbTXQZnJ8VGwMfgVjdH19F';
    public constructor(
        config: JVaultConfig
    ) {
        this.jVaultConfig = config;
        this.bundlerHelper = new BundlerHelper(config);
        this.OptionModuleV2Wrapper = new OptionModuleV2Wrapper(config.ethersSigner, config.data.contractData.OptionModuleV2);
        this.PriceOracleWrapper = new PriceOracleWrapper(config.ethersSigner, config.data.contractData.PriceOracle);
        this.OptionServiceWrapper = new OptionServiceWrapper(config.ethersSigner, config.data.contractData.OptionService);
        this.VaultManageModuleWrapper = new VaultManageModuleWrapper(config.ethersSigner, config.data.contractData.VaultManageModule);
    }
    public async fetchSignData(JVaultOrder: JVaultOrder): Promise<SignedPrice> {
        const s_url = 'https://quotes.jaspervault.io/api/public/signedPrice';
        const data = {
            'jvault_product': 'Degen',
            'base_asset': this.getTokenNamebyAddress(JVaultOrder.underlyingAsset),
            'quote_asset': this.getTokenNamebyAddress(JVaultOrder.premiumAsset),
            'premium_asset': this.getTokenNamebyAddress(JVaultOrder.premiumAsset),
            'product_type': JVaultOrder.secondsToExpiry,
            'option_type': JVaultOrder.optionType == 0 ? 'C' : 'P',
            'option_mode': 'EUO',
            'chain_id': JVaultOrder.chainId,
        };
        try {
            const response = await axios.post(s_url, data);
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

    public async placeOrder(
        JVaultOrder: JVaultOrder,
        txOpts: TransactionOverrides = {}
    ) {
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
        const optionOrder: IOptionModuleV2.ManagedOrderStruct = {
            holder: JVaultOrder.optionVault,
            writer: JVaultOrder.optionWriter,
            recipient: JVaultOrder.premiumVault,
            quantity: BigNumber.from(JVaultOrder.amount),
            productTypeIndex: ethers.constants.Zero,
            settingsIndex: ethers.constants.Zero,
            oracleIndex: BigNumber.from(0),
            premiumSign: premiumSign,
            nftFreeOption: ethers.constants.AddressZero,
        };
        //  await this.OptionModuleWrapper.SubmitManagedOrder(optionOrder, true);
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

        calldata_arr.push({
            dest: this.jVaultConfig.data.contractData.OptionModule,
            value: ethers.constants.Zero,
            data: await this.OptionModuleV2Wrapper.SubmitManagedOrder(optionOrder, true),
        });

        try {
            // await this.bundlerHelper.sendtoBundler(vault1_addr, 1, calldata_arr);
            return await this.bundlerHelper.sendtoVault(JVaultOrder.optionVault, calldata_arr, txOpts);
            console.log('Placing order:', optionOrder);
            ///
        }
        catch (error) {
            console.error('Error Placing order:', error);
        }
    }

    public async InitializeVaultAndplaceOrder(
        JVaultOrder: JVaultOrder,
        txOpts: TransactionOverrides = {}
    ) {
        const calldata_arr: BundlerOP[] = [];
        const contractData = this.jVaultConfig.data.contractData;
        const modules = [
            contractData.VaultPaymaster,
            contractData.VaultManageModule,
            contractData.IssuanceModule,
            contractData.OptionService,
            contractData.OptionModuleV2,
            contractData.PriceOracle];
        const modulesStatus = [true, true, true, true, true, true];
        // set moduleType
        console.log('Initializing vault:', JVaultOrder.optionVault, JVaultOrder.optionType == OptionType.CALL ? 7 : 3);
        calldata_arr.push({
            dest: contractData.VaultManageModule,
            value: ethers.constants.Zero,
            data: await this.VaultManageModuleWrapper.setVaultModule(JVaultOrder.optionVault, modules, modulesStatus, true),
        });
        // set vaultType
        calldata_arr.push({
            dest: contractData.VaultManageModule,
            value: ethers.constants.Zero,
            data: await this.VaultManageModuleWrapper.setVaultType(JVaultOrder.optionVault, JVaultOrder.optionType == OptionType.CALL ? 7 : 3, true),
        });
        // set vault Token

        const tokens = this.jVaultConfig.data.tokens.map(token => token.address);
        const tokens_types = this.jVaultConfig.data.tokens.map(token => BigNumber.from(token.type));
        calldata_arr.push({
            dest: contractData.VaultManageModule,
            value: ethers.constants.Zero,
            data: await this.VaultManageModuleWrapper.setVaultTokens(JVaultOrder.optionVault, tokens, tokens_types, true),
        });
        const signedData: SignedPrice = await this.fetchSignData(JVaultOrder);
        // console.log('signedData:', signedData);
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
                if (BigNumber.from(JVaultOrder.secondsToExpiry).eq(writer_config[i].productTypes[j])) {
                    productTypeIndex = BigNumber.from(j);
                    settingsIndex = BigNumber.from(i);
                    break;
                }
            }
        }
        const optionOrder: IOptionModuleV2.ManagedOrderStruct = {
            holder: JVaultOrder.optionVault,
            writer: JVaultOrder.optionWriter,
            recipient: JVaultOrder.premiumVault,
            quantity: BigNumber.from(JVaultOrder.amount),
            productTypeIndex: BigNumber.from(productTypeIndex),
            settingsIndex: BigNumber.from(settingsIndex),
            oracleIndex: BigNumber.from(0),
            premiumSign: premiumSign,
            nftFreeOption: ethers.constants.AddressZero,
        };
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

        calldata_arr.push({
            dest: this.jVaultConfig.data.contractData.OptionModuleV2,
            value: ethers.constants.Zero,
            data: await this.OptionModuleV2Wrapper.SubmitManagedOrder(optionOrder, true),
        });

        try {
            return await this.bundlerHelper.sendtoVault(JVaultOrder.optionVault, calldata_arr, txOpts);
        }
        catch (error) {
            console.error('Error Placing order:', error);
        }
    }

    public async getOptionWriterSettings(): Promise<any> {
        return optionWriterConfig;
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
            return await this.bundlerHelper.sendtoVault(JVaultOrder.optionVault, calldata_arr, txOpts);
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
            const response = await axios.post(this.jVaultgraphQLEndpoint, {
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
                const response_callorder = await axios.post(this.jVaultgraphQLEndpoint, {
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
                const response_putorder = await axios.post(this.jVaultgraphQLEndpoint, {
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

    private getTokenNamebyAddress(address: string): string {
        if (address === ADDRESSES.native_token) {
            return 'ETH';
        }
        for (const network in ADDRESSES) {
            for (const key in ADDRESSES[network]) {
                if (ADDRESSES[network][key] === address) {
                    return key;
                }
            }
        }
        return undefined;
    }


}