'use strict';
import { JVaultConfig, BundlerOP, SignedPrice, LiquidateType, OptionType, Address, DepositData } from '../utils/types/index';
import { JVaultOrder, OptionOrder, Bytes } from '../utils/types';
import {
    OptionModuleV2Wrapper,
    OptionModuleV4Wrapper,
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
import { EventEmitter } from 'events';
import logger from '../utils/j_logger';
import { TransactionHandler, JaspervaultTransactionHandler } from '../utils/JaspervaultTransactionHandler';
interface VaultResult {
    bundlerOP: BundlerOP[];
    vaultAddress: string;
}
export default class OptionTradingAPI {
    public txOpts: TransactionOverrides;
    private jVaultConfig: JVaultConfig;
    private OptionModuleV2Wrapper: OptionModuleV2Wrapper;
    private OptionModuleV4Wrapper: OptionModuleV4Wrapper;
    private PriceOracleWrapper: PriceOracleWrapper;
    private OptionServiceWrapper: OptionServiceWrapper;
    private VaultManageModuleWrapper: VaultManageModuleWrapper;
    private IssuanceModuleWrapper: IssuanceModuleWrapper;
    private VaultFactoryWrapper: VaultFactoryWrapper;
    private ManagerWrapper: ManagerWrapper;
    private TransactionHandler: TransactionHandler;
    private eventEmitter: EventEmitter;

    /**
     *
     * @param config JVaultConfig
     */
    public constructor(
        config: JVaultConfig
    ) {
        this.jVaultConfig = config;
        this.OptionModuleV2Wrapper = new OptionModuleV2Wrapper(config.ethersSigner, config.data.contractData.OptionModuleV2);
        this.OptionModuleV4Wrapper = new OptionModuleV4Wrapper(config.ethersSigner, config.data.contractData.OptionModuleV4);
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
        this.eventEmitter = new EventEmitter();
        const eventEmitter = this.TransactionHandler.getEventEmitter();
        eventEmitter.on('beforeSubmitToBundler', data => {
            this.eventEmitter.emit('beforeSubmitToBundler', data);
        });
        eventEmitter.on('afterSubmitToBundler', data => {
            this.eventEmitter.emit('afterSubmitToBundler', data);
        });

        this.txOpts = config.gasSettings;
        if (this.txOpts == undefined) {
            this.txOpts = {
                maxFeePerGas: ethers.utils.parseUnits(config.data.defaultFeeData.maxFeePerGas, 'gwei').add(ethers.utils.parseUnits(config.data.defaultFeeData.maxPriorityFeePerGas, 'gwei')),
                maxPriorityFeePerGas: ethers.utils.parseUnits(config.data.defaultFeeData.maxPriorityFeePerGas, 'gwei'),
            };
        }

    }

    public async getTransactionHandler() {
        return this.TransactionHandler;
    }

    /**
     *
     * @returns {EventEmitter} - A promise that resolves to the event emitter.
     */
    public getEventEmitter(): EventEmitter {
        return this.eventEmitter;
    }

    /**
     *
     * @param JVaultOrder
     * @returns A promise that resolves to the premium sign data.
     */
    public async fetchSignData(JVaultOrder: JVaultOrder): Promise<IOptionModuleV2.PremiumOracleSignStruct> {
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
        this.eventEmitter.emit('beforeFetchQuote', data);
        try {
            let response;
            if (JVaultOrder.timestamp && JVaultOrder.signature) {

                const requestData = {
                    ...data,
                    unlock_time_span: JVaultOrder.unlockTimeSpan,
                };

                const optionQuotesUrl = `${this.jVaultConfig.data.optionQuotesUrl}/nft/${JVaultOrder.timestamp}`;
                response = await axios.post(optionQuotesUrl, requestData, {
                    headers: {
                        'Content-Type': 'application/json',
                        'signature': JVaultOrder.signature,
                    },
                });
            } else {
                // common order
                response = await axios.post(this.jVaultConfig.data.optionQuotesUrl, data);
            }

            if (response.status == 200) {
                const signedData: SignedPrice = {
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
                // logger.info('premiumSign:', premiumSign);
                this.eventEmitter.emit('afterFetchQuote', premiumSign);
                return premiumSign;
            }
        } catch (error) {
            logger.error('Error making fetchSignData request:', error);
            throw error;
        }
    }

    /**
     * @deprecated This method will be deprecated soon. Please use `createDegenOrder` instead.
     *
     * Creates an order with the given parameters.
     *
     * @param {JVaultOrder} JVaultOrder - The order details.
     * @param {TransactionOverrides} [txOpts={}] - Optional transaction overrides.
     * @returns {Promise<string>} - A promise that resolves to the transaction hash.
     */
    public async createOrder(
        JVaultOrder: JVaultOrder,
        txOpts: TransactionOverrides = {}
    ): Promise<string> {
        return await this.createDegenBatchOrders([JVaultOrder], txOpts);
    }

    /**
     * Creates an Degen order with the given parameters.
     *
     * @param {JVaultOrder} JVaultOrder - The order details.
     * @param {TransactionOverrides} [txOpts={}] - Optional transaction overrides.
     * @returns {Promise<string>} - A promise that resolves to the transaction hash.
     */
    public async createDegenOrder(
        JVaultOrder: JVaultOrder,
        txOpts: TransactionOverrides = {}
    ): Promise<string> {
        return await this.createDegenBatchOrders([JVaultOrder], txOpts);
    }

    /**
     * Creates multiple Degen orders with the given parameters.
     *
     * @param {JVaultOrder[]} JVaultOrders - The order details.
     * @param {TransactionOverrides} [txOpts={}] - Optional transaction overrides.
     * @returns {Promise<string>} - A promise that resolves to the transaction hash.
     */
    public async createDegenBatchOrders(
        JVaultOrders: JVaultOrder[],
        txOpts: TransactionOverrides = {}
    ): Promise<string> {
        if (JVaultOrders.length == 0) {
            throw new Error('No orders to place');
        }
        const calldata_arr: BundlerOP[] = [];

        const maxVaultSalt = await this.VaultFactoryWrapper.getVaultMaxSalt(this.jVaultConfig.EOA);
        let newVaultIndex = maxVaultSalt.add(1);
        if (maxVaultSalt.eq(0) || maxVaultSalt.eq(1)) {
            newVaultIndex = BigNumber.from(2);
        }
        const vault1checkResult = await this.checkAndInitializeVault(ethers.constants.AddressZero);
        calldata_arr.push(...vault1checkResult.bundlerOP);
        if (this.jVaultConfig.data.pythPriceFeedAddr != '') {
            calldata_arr.push(...await this.setPrice([]));
        }
        if (this.jVaultConfig.data.aproEndpoint != undefined) {
            calldata_arr.push(...await this.setPrice_APRO([]));
        }

        for (let i = 0; i < JVaultOrders.length; i++) {
            if (JVaultOrders[i].optionVault == ethers.constants.AddressZero) {
                JVaultOrders[i].optionVault = await this.VaultFactoryWrapper.getAddress(this.jVaultConfig.EOA, newVaultIndex);
                JVaultOrders[i].optionVaultIndex = newVaultIndex;
                newVaultIndex = newVaultIndex.add(1);
            }
            const premiumSign: IOptionModuleV2.PremiumOracleSignStruct = await this.fetchSignData(JVaultOrders[i]);
            JVaultOrders[i].premiumSign = premiumSign;
            logger.info(`premiumSign: ${JSON.stringify(premiumSign)}`);
            JVaultOrders[i].depositData = await this.getDepositData(JVaultOrders[i]);
        }
        const depositPremiumOP = await this.depositPremium(JVaultOrders[0].premiumVault, JVaultOrders);
        if (depositPremiumOP.length > 0) {
            calldata_arr.push(...depositPremiumOP);
        }
        for (let i = 0; i < JVaultOrders.length; i++) {
            const JVaultOrder = JVaultOrders[i];
            const newVaultResult = await this.checkAndInitializeVault(JVaultOrder.optionVault, JVaultOrder);
            calldata_arr.push(...newVaultResult.bundlerOP);
            JVaultOrder.optionVault = newVaultResult.vaultAddress;
            calldata_arr.push(...await this.submitOrder(JVaultOrder));
        }
        try {
            if (this.TransactionHandler instanceof JaspervaultTransactionHandler) {
                if (Object.keys(txOpts).length == 0) {
                    txOpts = this.txOpts;
                    logger.info(`txOpts use default: ${ethers.utils.formatUnits(this.txOpts.maxFeePerGas, 'gwei')} -- ${ethers.utils.formatUnits(this.txOpts.maxPriorityFeePerGas, 'gwei')}`);
                    logger.info(`txOpts: ${JSON.stringify(txOpts)}`);
                }
            }
            const tx = await this.TransactionHandler.sendTransaction(JVaultOrders[0].premiumVault, calldata_arr, txOpts);
            return tx;

        }
        catch (error) {
            logger.error('Error Placing order:', error);
            throw new Error(error);
        }
    }

    /**
     *
     * @param vaultAddress
     * @returns A promise that resolves to the vault modules status.
     */
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
            // logger.info('module  --> status:', getActiveModules[i], status);
            if (status == false) {
                return false;
            }
        }
        return true;
    }

    public getActiveModulesOfVault(): string[] {
        const contractData = this.jVaultConfig.data.contractData;
        const activeModules = [
            contractData.VaultFactory,
            contractData.VaultManageModule,
            contractData.OptionModuleV2,
            contractData.OptionModuleV4,
            contractData.IssuanceModule,
            contractData.PriceOracle,
            contractData.OptionService,
            contractData.VaultPaymaster,
        ];
        if (this.jVaultConfig.data.nftWaiver) {
            if (this.jVaultConfig.data.nftWaiver.JSBT != ethers.constants.AddressZero) {
                activeModules.push(this.jVaultConfig.data.nftWaiver.JSBT);
            }
        }
        return activeModules;
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
        logger.info(`earnings: ${earnings}`);
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
            logger.error('Error liquidateOrder:', error);
        }
    }

    /**
     *
     * @param transactionHash
     * @returns A promise that resolves to the option order details.
     */
    public async getOrderByHash(transactionHash: string): Promise<OptionOrder[]> {
        const orders: OptionOrder[] = [];
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
            const optionPremiums = response.data.data.optionPremiums;
            if (!optionPremiums) {
                return undefined;
            }
            for (let i = 0; i < optionPremiums.length; i++) {
                const optionPremium = optionPremiums[i];

                if (optionPremium.orderType == 0) {
                    const order_query = `
                query CallOrderEntity {
    callOrderEntityV2S(where: { orderId: "${optionPremium.orderID}" }) {
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
                    orders.push(order);
                }
                else {
                    const order_query = `
                query PutOrderEntity {
    putOrderEntityV2S(where: { orderId: "${optionPremium.orderID}" }) {
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
                    orders.push(order);

                }
            }
            return orders;
        } catch (error) {
            logger.error('Error fetching order data:', error);
            return undefined;
        }
    }

    /**
     *
     * @returns {Promise<any>} - A promise that resolves to the option writer settings.
     * @deprecated Use getOptionWriterSettingsFromAPI instead which provides more flexibility
     */
    public async getOptionWriterSettings(): Promise<any> {

        return this.getOptionWriterSettingsFromAPI();
    }

    /**
     * Get option writer settings from API
     * @param {string} chain - Chain name, defaults to network in config
     * @param {string} symbol - Token symbol, e.g. ETH, WBTC
     * @returns {Promise<any>} - Returns option writer settings
     */
    public async getOptionWriterSettingsFromAPI(chain?: string, symbol?: string): Promise<any> {
        try {
            // If parameters not provided, use defaults
            const chainName = chain || this.jVaultConfig.network;
            // Convert chain name to uppercase for API
            const upperChain = chainName.toUpperCase();

            // If no symbol provided, use local config
            if (!symbol) {
                return optionWriterConfig;
            }

            // Build API URL
            const apiUrl = `https://apiv2.jaspervault.io/orders/dte_vault_list?chain=${upperChain}&symbol=${symbol}`;

            logger.info(`Fetching option writer settings from: ${apiUrl}`);
            const response = await axios.get(apiUrl);

            if (response.status === 200 && response.data.status === 0) {
                // Convert API response to local config format
                const result = {};
                result[chainName] = {
                    'CALL': {},
                    'PUT': {},
                };

                // Extract valid records from API data
                const validData = response.data.data.filter(item =>
                    item.callSettingIndex !== '-1' && item.putSettingIndex !== '-1'
                );

                if (validData.length > 0) {
                    // Use first record's addresses
                    result[chainName]['CALL'][symbol] = validData[0].callAddress;
                    result[chainName]['PUT'][symbol] = validData[0].putAddress;

                    logger.info(`Successfully fetched option writer settings for ${symbol} on ${chainName}`);
                    return result;
                } else {
                    logger.warn(`No valid option writer settings found for ${symbol} on ${chainName}, fallback to local config`);
                    return optionWriterConfig;
                }
            } else {
                logger.error(`Failed to fetch option writer settings: ${response.data.message}`);
                return optionWriterConfig;
            }
        } catch (error) {
            logger.error('Error fetching option writer settings:', error);
            // Fall back to local config on error
            return optionWriterConfig;
        }
    }

    private async getDepositData(JVaultOrder: JVaultOrder): Promise<DepositData> {
        const depositData: DepositData = {
            vault: JVaultOrder.premiumVault,
            amount: ethers.constants.Zero,
            token: JVaultOrder.premiumAsset,
            isERC20: JVaultOrder.premiumAsset != this.jVaultConfig.data.eth,
        };
        if (JVaultOrder.amount.eq(BigNumber.from(0)) == false) {
            const premium = BigNumber.from(JVaultOrder.premiumSign.premiumFee).mul(BigNumber.from(JVaultOrder.amount)).div(ethers.constants.WeiPerEther);
            logger.info(`premium: ${premium.toString()}`);
            let balanceOfPremiumVault: BigNumber = ethers.constants.Zero;
            if (JVaultOrder.nftWaiver) {
                if (this.jVaultConfig.data.nftWaiver.JSBTIds.some(item => item.value.toString() === JVaultOrder.nftId.toString()) && JVaultOrder.nftWaiver == this.jVaultConfig.data.nftWaiver.JSBT) {
                    logger.info(`use nftWaiver: ${JVaultOrder.nftId.toString()} -- ${JVaultOrder.nftWaiver}`);
                    balanceOfPremiumVault = premium;
                }
            } else {
                if (JVaultOrder.premiumAsset == this.jVaultConfig.data.eth) {
                    balanceOfPremiumVault = await this.jVaultConfig.ethersProvider.getBalance(JVaultOrder.premiumVault);
                }
                else {
                    const premium_asset = new ERC20Wrapper(this.jVaultConfig.ethersSigner, JVaultOrder.premiumAsset);
                    balanceOfPremiumVault = await premium_asset.balanceOf(JVaultOrder.premiumVault);
                }
            }
            logger.info(`balanceOfPremiumVault:${balanceOfPremiumVault.toString()}`);
            if (balanceOfPremiumVault.lt(premium) == true) {
                const transferAmount = premium.sub(balanceOfPremiumVault).mul(BigNumber.from(101)).div(BigNumber.from(100));
                let EOA_balance = ethers.constants.Zero;
                if (JVaultOrder.premiumAsset == this.jVaultConfig.data.eth) {
                    EOA_balance = await this.jVaultConfig.ethersProvider.getBalance(this.jVaultConfig.EOA);
                }
                else {
                    const premium_asset = new ERC20Wrapper(this.jVaultConfig.ethersSigner, JVaultOrder.premiumAsset);
                    EOA_balance = await premium_asset.balanceOf(this.jVaultConfig.EOA);
                }
                if (EOA_balance.gte(transferAmount) == true) {
                    depositData.amount = transferAmount;
                }
                else {
                    throw new Error(`getDepositData:EOA_balance premiumAsset :${EOA_balance} Insufficient balance`);
                }
            }
        }

        return depositData;
    }

    private async checkAndInitializeVault(vaultAddress: Address, JVaultOrder?: JVaultOrder): Promise<VaultResult> {
        const calldata_arr: BundlerOP[] = [];
        let vault_1: Address = JVaultOrder != undefined ? JVaultOrder.premiumVault : ethers.constants.AddressZero;
        if (vaultAddress == ethers.constants.AddressZero) {
            if (JVaultOrder == undefined) {
                vault_1 = vaultAddress = await this.VaultFactoryWrapper.getAddress(this.jVaultConfig.EOA, 1);
            }
            else {
                if (vault_1 == ethers.constants.AddressZero) {
                    vault_1 = await this.VaultFactoryWrapper.getAddress(this.jVaultConfig.EOA, 1);
                }
                if (JVaultOrder.optionVault == ethers.constants.AddressZero) {
                    const maxVaultSalt = await this.VaultFactoryWrapper.getVaultMaxSalt(this.jVaultConfig.EOA);
                    let newVaultIndex = maxVaultSalt.add(1);
                    if (maxVaultSalt.eq(0) || maxVaultSalt.eq(1)) {
                        newVaultIndex = BigNumber.from(2);
                    }
                    vaultAddress = await this.VaultFactoryWrapper.getAddress(this.jVaultConfig.EOA, newVaultIndex);
                }
            }
        }
        const code = await this.jVaultConfig.ethersProvider.getCode(vaultAddress);
        if (code == '0x') {
            logger.info(`Vault ${vaultAddress} not been created`);
            if (JVaultOrder != undefined) {
                if (vaultAddress == JVaultOrder.optionVault) {
                    calldata_arr.push({
                        dest: this.jVaultConfig.data.contractData.VaultFactory,
                        value: ethers.constants.Zero,
                        data: await this.VaultFactoryWrapper.createAccount(this.jVaultConfig.EOA, JVaultOrder.optionVaultIndex, true),
                    });
                    calldata_arr.push(...await this.initializeVault(JVaultOrder.optionVault, JVaultOrder.optionType == OptionType.CALL ? 7 : 3));
                }
            }
            else {
                logger.info(`vault_1 code = 0x: ${vault_1}`);
                calldata_arr.push(...await this.initializeVault(vaultAddress, 1));
            }
        }
        else {
            if (vaultAddress == vault_1) {
                logger.info('check is init vault_1:', vault_1);
                calldata_arr.push(...await this.initializeVault(vaultAddress, 1, !await this.checkVaultModulesStatus(vaultAddress)));
            }
            else {
                calldata_arr.push(...await this.initializeVault(vaultAddress, JVaultOrder.optionType == OptionType.CALL ? 7 : 3, !await this.checkVaultModulesStatus(vaultAddress)));
            }
        }


        return { bundlerOP: calldata_arr, vaultAddress: vaultAddress };

    }



    private async initializeVault(vaultAddress: Address, vaultType: number, moduleCheck: boolean = true, tokenCheck: boolean = true): Promise<BundlerOP[]> {
        const calldata_arr: BundlerOP[] = [];
        const vault_0 = await this.VaultFactoryWrapper.getAddress(this.jVaultConfig.EOA, 0);
        const contractData = this.jVaultConfig.data.contractData;
        if (moduleCheck) {
            const modules = this.getActiveModulesOfVault();
            const modulesStatus = modules.map(() => true);
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

    /**
     * get APRO setprice data
     *
     * @param {string[]} priceIds - The price IDs to fetch price data for.
     * @returns {Promise<BundlerOP[]>} - A promise that resolves to the calldata array.
     */
    private async setPrice_APRO(priceIds: string[]): Promise<BundlerOP[]> {
        const calldata_arr: BundlerOP[] = [];
        if (priceIds.length == 0) {
            for (let i = 0; i < this.jVaultConfig.data.apro.length; i++) {
                priceIds.push(this.jVaultConfig.data.apro[i].id);
            }
        }
        const feedIDsParam = priceIds.join(',');


        try {
            const response = await axios.get(`${this.jVaultConfig.data.aproEndpoint}/api/v1/reports/bulk`, {
                params: {
                    feedIDs: feedIDsParam,
                    timestamp: 'latest',
                },
                headers: {
                    'Authorization': this.jVaultConfig.data.aproAuthorization,
                    'X-Authorization-Timestamp': Date.now(),
                    'Content-Type': 'application/json',
                },
            });
            if (response.data.reports.length == 0) {
                throw new Error('Reports empty! Failed to fetch APRO price feed update data');
            }
            const priceFeedUpdateData = [];
            for (const i in response.data.reports) {
                priceFeedUpdateData.push(response.data.reports[i].fullReport);
            }
            calldata_arr.push({
                dest: this.jVaultConfig.data.contractData.PriceOracle,
                value: ethers.constants.Zero,
                data: await this.PriceOracleWrapper.setPriceV2(ethers.constants.Zero, priceFeedUpdateData, true),
            });
        } catch (error) {
            logger.error('Error fetching price feed update data:', error);
            throw new Error('Failed to fetch price feed update data');
        }

        return calldata_arr;
    }

    private async submitOrder(JVaultOrder: JVaultOrder): Promise<BundlerOP[]> {
        const moduleVersion = JVaultOrder.moduleVersion || 'V2';

        if (moduleVersion === 'V4') {
            return this.submitOrderV4(JVaultOrder);
        } else {
            return this.submitOrderV2(JVaultOrder);
        }
    }

    private async submitOrderV2(JVaultOrder: JVaultOrder): Promise<BundlerOP[]> {
        const calldata_arr: BundlerOP[] = [];
        const writer_config = await this.OptionModuleV2Wrapper.getManagedOptionsSettings(JVaultOrder.optionWriter);
        let productTypeIndex = BigNumber.from(0);
        let settingsIndex = BigNumber.from(0);
        let offerID = BigNumber.from(0);
        for (let i = 0; i < writer_config.length; i++) {
            if (writer_config[i].orderType !== JVaultOrder.optionType) {
                continue;
            }
            for (let j = 0; j < writer_config[i].productTypes.length; j++) {
                if (writer_config[i].underlyingAsset.toLowerCase() == JVaultOrder.underlyingAsset.toLowerCase()) {
                    if (BigNumber.from(JVaultOrder.secondsToExpiry).eq(writer_config[i].productTypes[j])) {
                        productTypeIndex = BigNumber.from(j);
                        settingsIndex = BigNumber.from(i);
                        offerID = BigNumber.from(writer_config[i].offerID);
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
            premiumSign: JVaultOrder.premiumSign,
            nftFreeOption: JVaultOrder.nftWaiver ? JVaultOrder.nftWaiver : ethers.constants.AddressZero,
            optionSourceType: ethers.constants.Zero,
            liquidationToEOA: false,
            offerID: offerID,
        };
        if (JVaultOrder.nftId != undefined) {
            logger.info(`nftId: ${JVaultOrder.nftId}`);
            if (this.jVaultConfig.data.nftWaiver.JSBT != ethers.constants.AddressZero) {
                const setAboutToUseNftId_abi = [
                    {
                        'inputs': [
                            {
                                'internalType': 'uint256',
                                'name': '_nftId',
                                'type': 'uint256',
                            },
                        ],
                        'name': 'setAboutToUseNftId',
                        'outputs': [],
                        'stateMutability': 'nonpayable',
                        'type': 'function',
                    },
                ];
                const iface = new ethers.utils.Interface(setAboutToUseNftId_abi);
                calldata_arr.push({
                    dest: this.jVaultConfig.data.nftWaiver.JSBT,
                    value: ethers.constants.Zero,
                    data: iface.encodeFunctionData('setAboutToUseNftId', [JVaultOrder.nftId]),
                });
            }
        }
        calldata_arr.push({
            dest: this.jVaultConfig.data.contractData.OptionModuleV2,
            value: ethers.constants.Zero,
            data: await this.OptionModuleV2Wrapper.SubmitManagedOrder(optionOrder, true),
        });
        return calldata_arr;
    }

    private async submitOrderV4(JVaultOrder: JVaultOrder): Promise<BundlerOP[]> {
        const calldata_arr: BundlerOP[] = [];
        const writer_config = await this.OptionModuleV2Wrapper.getManagedOptionsSettings(JVaultOrder.optionWriter);
        let productTypeIndex = BigNumber.from(0);
        let settingsIndex = BigNumber.from(0);
        let offerID = BigNumber.from(0);
        for (let i = 0; i < writer_config.length; i++) {
            if (writer_config[i].orderType == JVaultOrder.optionType) {
                for (let j = 0; j < writer_config[i].productTypes.length; j++) {
                    if (writer_config[i].underlyingAsset.toLowerCase() == JVaultOrder.underlyingAsset.toLowerCase()) {
                        if (BigNumber.from(JVaultOrder.secondsToExpiry).eq(writer_config[i].productTypes[j])) {
                            productTypeIndex = BigNumber.from(j);
                            settingsIndex = BigNumber.from(i);
                            offerID = BigNumber.from(writer_config[i].offerID);
                            break;
                        }
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
            premiumSign: JVaultOrder.premiumSign,
            nftFreeOption: JVaultOrder.nftWaiver ? JVaultOrder.nftWaiver : ethers.constants.AddressZero,
            optionSourceType: ethers.constants.Zero,
            liquidationToEOA: false,
            offerID: offerID,
        };
        if (JVaultOrder.nftId != undefined) {
            logger.info(`nftId: ${JVaultOrder.nftId}`);
            if (this.jVaultConfig.data.nftWaiver.JSBT != ethers.constants.AddressZero) {
                const setAboutToUseNftId_abi = [
                    {
                        'inputs': [
                            {
                                'internalType': 'uint256',
                                'name': '_nftId',
                                'type': 'uint256',
                            },
                        ],
                        'name': 'setAboutToUseNftId',
                        'outputs': [],
                        'stateMutability': 'nonpayable',
                        'type': 'function',
                    },
                ];
                const iface = new ethers.utils.Interface(setAboutToUseNftId_abi);
                calldata_arr.push({
                    dest: this.jVaultConfig.data.nftWaiver.JSBT,
                    value: ethers.constants.Zero,
                    data: iface.encodeFunctionData('setAboutToUseNftId', [JVaultOrder.nftId]),
                });
            }
        }
        calldata_arr.push({
            dest: this.jVaultConfig.data.contractData.OptionModuleV4,
            value: ethers.constants.Zero,
            data: await this.OptionModuleV4Wrapper.submitManagedOrderV4(optionOrder, true),
        });
        return calldata_arr;
    }

    private async depositPremium(premiumVault: Address, JVaultOrders: JVaultOrder[]): Promise<BundlerOP[]> {
        const calldata_arr: BundlerOP[] = [];
        if (JVaultOrders.length == 0) {
            return calldata_arr;
        }
        let depositAmount = ethers.constants.Zero;
        const premiumAsset = JVaultOrders[0].premiumAsset;
        for (let i = 0; i < JVaultOrders.length; i++) {
            const JVaultOrder = JVaultOrders[i];
            if (JVaultOrder.depositData) {
                if (JVaultOrder.depositData.amount.eq(ethers.constants.Zero) == false) {
                    depositAmount = depositAmount.add(JVaultOrder.depositData.amount);
                }
            }
        }
        if (depositAmount.gt(ethers.constants.Zero) == true) {
            if (premiumAsset == this.jVaultConfig.data.eth) {
                const balanceOfEOA = await this.jVaultConfig.ethersProvider.getBalance(this.jVaultConfig.EOA);
                if (balanceOfEOA.lt(depositAmount) == true) {
                    throw new Error(`EOA_balance :${balanceOfEOA} Insufficient balance`);
                }
                this.eventEmitter.emit('beforeDepositNativeToken', depositAmount);
                const tx = await this.jVaultConfig.ethersSigner.sendTransaction({
                    to: premiumVault,
                    value: depositAmount,
                });
                await tx.wait(this.jVaultConfig.data.safeBlock);
                this.eventEmitter.emit('afterDepositNativeToken', tx.hash);
            }
            else {
                const premiumAsset_erc20wrapper = new ERC20Wrapper(this.jVaultConfig.ethersSigner, premiumAsset);
                const balanceOfEOA = await premiumAsset_erc20wrapper.balanceOf(this.jVaultConfig.EOA);
                if (balanceOfEOA.lt(depositAmount) == true) {
                    throw new Error(`EOA_balance premiumAsset ${await premiumAsset_erc20wrapper.name()} :${balanceOfEOA} Insufficient balance`);
                }
                const allowance = await premiumAsset_erc20wrapper.allowance(this.jVaultConfig.EOA, premiumVault);
                if (allowance.lt(depositAmount)) {
                    logger.info(`approve: ${depositAmount.toString()}`);
                    this.eventEmitter.emit('beforeApprove', allowance, depositAmount);
                    const tx = await premiumAsset_erc20wrapper.approve(premiumVault, depositAmount, this.txOpts);
                    await tx.wait(this.jVaultConfig.data.safeBlock);
                    this.eventEmitter.emit('afterApprove', tx);
                }
                calldata_arr.push({
                    dest: this.jVaultConfig.data.contractData.IssuanceModule,
                    value: ethers.constants.Zero,
                    data: await this.IssuanceModuleWrapper.issue(premiumVault, this.jVaultConfig.EOA, [premiumAsset], [depositAmount], true),
                });
            }
        }
        else {
            logger.info('No need to deposit');
        }
        return calldata_arr;
    }

    private async getPythPriceFeedUpdateData(tokens: string[]): Promise<any> {
        const connection = new EvmPriceServiceConnection('https://hermes.pyth.network');
        const priceFeedUpdateData = await connection.getPriceFeedsUpdateData(tokens);
        return priceFeedUpdateData;
    }

    private getTokenNamebyAddress(address: string, chain: string): string {
        const chainTokens = ADDRESSES[chain];
        if (!chainTokens) {
            logger.error(`Chain ${chain} not found`);
            return undefined;
        }
        for (const [tokenName, tokenAddress] of Object.entries(chainTokens)) {
            if ((tokenAddress as string).toLowerCase() === address.toLowerCase()) {
                return tokenName;
            }
        }
        logger.error(`Address ${address} not found on chain ${chain}`);
        return undefined;
    }
}