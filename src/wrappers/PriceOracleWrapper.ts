import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address, Bytes, Uint256 } from '../utils/types';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';

export default class PriceOracleWrapper {
    private signer: Signer;
    private contracts: ContractWrapper;
    private PriceOracleAddress: Address;
    public constructor(signer: Signer, priceOracleAddress: Address) {
        this.signer = signer;
        this.contracts = new ContractWrapper(this.signer);
        this.PriceOracleAddress = priceOracleAddress;
    }
    public async setPrice(pyth_addr: Address, priceUpdateData: Bytes[], encodeFunc?: boolean, txOpts: TransactionOverrides = {}) {
        const PriceOracle = this.contracts.getPriceOracle(this.PriceOracleAddress);
        try {
            if (encodeFunc) {
                return PriceOracle.interface.encodeFunctionData('setPrice', [pyth_addr, priceUpdateData]);
            }
            else {
                return await PriceOracle.setPrice(pyth_addr, priceUpdateData, txOpts);
            }
        }
        catch (error) {
            console.error('Error setPrice:', error);
        }
    }

    public async setPriceV2(index: Uint256, priceUpdateData: Bytes[], encodeFunc?: boolean, txOpts: TransactionOverrides = {}) {
        const PriceOracle = this.contracts.getPriceOracle(this.PriceOracleAddress);
        try {
            if (encodeFunc) {
                return PriceOracle.interface.encodeFunctionData('setPriceV2', [index, priceUpdateData]);
            }
            else {
                return await PriceOracle.setPriceV2(index, priceUpdateData, txOpts);
            }
        }
        catch (error) {
            console.error('Error setPriceV2:', error);
        }
    }
}