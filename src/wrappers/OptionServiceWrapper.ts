import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address, Uint256, Uint64 } from '../utils/types';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';


export default class OptionServiceWrapper {
    private signer: Signer;
    private contracts: ContractWrapper;
    private OptionServiceAddress: Address;

    public constructor(signer: Signer, optionModuleAddress: Address) {
        this.signer = signer;
        this.contracts = new ContractWrapper(this.signer);
        this.OptionServiceAddress = optionModuleAddress;
    }

    public async setPriceOracle(priceOracle: Address,
        txOpts: TransactionOverrides = {}) {
        try {
            const optionService = this.contracts.getOptionService(this.OptionServiceAddress);
            return await optionService.setPriceOracle(priceOracle, txOpts);
        }
        catch (error) {
            console.error('Error initializing extension:', error);
        }
    }


    public async liquidateOption(
        orderType: Uint256,
        orderID: Uint64,
        type: Uint256,
        income_amount: Uint256,
        slippage: Uint256,
        encodeFunc?: boolean,
        txOpts: TransactionOverrides = {}
    ) {
        try {
            const optionService = this.contracts.getOptionService(this.OptionServiceAddress);
            if (encodeFunc) {
                return optionService.interface.encodeFunctionData('liquidateOption', [orderType, orderID, type, income_amount, slippage]);
            }
            else {
                return optionService.liquidateOption(orderType, orderID, type, income_amount, slippage, txOpts);
            }
        }
        catch (error) {
            console.error('Error liquidateOption:', error);
        }
    }

    public async validSlippage(amountA: Uint256, amountB: Uint256, holder_slippage: Uint256, writer_slippage: Uint256) {
        try {
            const optionService = this.contracts.getOptionService(this.OptionServiceAddress);
            return await optionService.validSlippage(amountA, amountB, holder_slippage, writer_slippage);
        }
        catch (error) {
            console.error('Error initializing extension:', error);
        }
    }

    public async getEarningsAmount(lock_asset: Address, lock_amount: Uint256, strike_asset_addr: Address, strike_amount: Uint256) {
        try {
            const optionService = this.contracts.getOptionService(this.OptionServiceAddress);
            return await optionService.getEarningsAmount(lock_asset, lock_amount, strike_asset_addr, strike_amount);
        }
        catch (error) {
            console.error('Error getEarningsAmount:', error);
        }
    }

}