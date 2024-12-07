'use strict';
import {
    ERC20Wrapper
} from '../wrappers/';
import { JVaultConfig, Address } from '../utils/types/index';
import { Uint256 } from '../utils/types';
import { BigNumber } from 'ethers';

export default class BlockchainAPI {
    private erc20Wrapper: ERC20Wrapper;
    private jVaultConfig: JVaultConfig;

    public constructor(
        config: JVaultConfig
    ) {
        this.jVaultConfig = config;
    }

    /**
     * Gets balance of the ERC20 token
     *
     * @param  tokenAddress  Address of the ERC20 token
     * @param  userAddress   Address of the user
     * @return               The balance of the ERC20 token in BigNumber format
     */
    public async getBalanceAsync(
        tokenAddress: Address,
        accountAddress: Address
    ): Promise<Uint256> {
        this.erc20Wrapper = new ERC20Wrapper(this.jVaultConfig.ethersSigner, tokenAddress);
        return await this.erc20Wrapper.balanceOf(
            accountAddress
        );
    }

    /**
     * Gets name of the ERC20 token
     *
     * @param  tokenAddress  Address of the ERC20 token
     * @return               The name of the ERC20 token
     */
    public async getTokenNameAsync(
        tokenAddress: Address
    ): Promise<string> {
        this.erc20Wrapper = new ERC20Wrapper(this.jVaultConfig.ethersSigner, tokenAddress);
        return await this.erc20Wrapper.name();
    }

    /**
     * Gets symbol of the ERC20 token
     *
     * @param  tokenAddress  Address of the ERC20 token
     * @return               The symbol of the ERC20 token
     */
    public async getTokenSymbolAsync(
        tokenAddress: Address

    ): Promise<string> {
        this.erc20Wrapper = new ERC20Wrapper(this.jVaultConfig.ethersSigner, tokenAddress);
        return this.erc20Wrapper.symbol();
    }

    /**
     * Gets the total supply of the ERC20 token
     *
     * @param  tokenAddress  Address of the ERC20 token
     * @return               The total supply of ERC-20 in BigNumber format
     */
    public async getTotalSupplyAsync(
        tokenAddress: Address
    ): Promise<BigNumber> {
        this.erc20Wrapper = new ERC20Wrapper(this.jVaultConfig.ethersSigner, tokenAddress);

        return await this.erc20Wrapper.totalSupply();
    }

    /**
     * Gets decimals of the ERC20 token
     *
     * @param  tokenAddress  Address of the ERC20 token
     * @return               The decimals of the ERC20 token
     */
    public async getDecimalsAsync(
        tokenAddress: Address
    ): Promise<number> {
        this.erc20Wrapper = new ERC20Wrapper(this.jVaultConfig.ethersSigner, tokenAddress);

        return await this.erc20Wrapper.decimals();
    }

    /**
     * Gets the token allowance of the spender by the owner account
     *
     * @param  tokenAddress      Address of the token
     * @param  ownerAddress      Address of the owner
     * @param  spenderAddress    Address of the spender
     * @return                   The allowance of the spender in BigNumber format
     */
    public async getAllowanceAsync(
        tokenAddress: Address,
        ownerAddress: Address,
        spenderAddress: Address
    ): Promise<BigNumber> {
        this.erc20Wrapper = new ERC20Wrapper(this.jVaultConfig.ethersSigner, tokenAddress);
        return await this.erc20Wrapper.allowance(
            ownerAddress,
            spenderAddress
        );
    }

    public async transferAsync(
        tokenAddress: Address,
        toAddress: Address,
        amount: Uint256
    ) {
        this.erc20Wrapper = new ERC20Wrapper(this.jVaultConfig.ethersSigner, tokenAddress);
        return await this.erc20Wrapper.transfer(
            toAddress,
            amount
        );
    }

    public async transferNativeTokenAsync(
        toAddress: Address,
        amount: Uint256
    ) {
        return await this.jVaultConfig.ethersSigner.sendTransaction({
            to: toAddress,
            value: amount,
        });
    }
}