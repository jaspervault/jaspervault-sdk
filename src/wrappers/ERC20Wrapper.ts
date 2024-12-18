import { Signer } from '@ethersproject/abstract-signer';
import ContractWrapper from './ContractWrapper';
import { Address, Uint256 } from '../utils/types';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';
export default class ERC20Wrapper {
    private signer: Signer;
    private contracts: ContractWrapper;
    private ERC20Address: Address;

    public constructor(signer: Signer, ERC20Address: Address) {
        this.signer = signer;
        this.contracts = new ContractWrapper(this.signer);
        this.ERC20Address = ERC20Address;
    }

    public async transfer(to: Address, value: Uint256, txOpts: TransactionOverrides = {}): Promise<any> {
        try {
            const erc20 = await this.contracts.getERC20(this.ERC20Address);
            return await erc20.transfer(to, value, txOpts);
        }
        catch (error) {
            console.error('Error transferring asset:', error);
        }
    }

    public async balanceOf(account: Address): Promise<Uint256> {
        try {
            const erc20 = await this.contracts.getERC20(this.ERC20Address);
            return await erc20.balanceOf(account);
        }
        catch (error) {
            console.error('Error getting balance:', error);
        }
    }

    public async approve(spender: Address, value: Uint256, txOpts: TransactionOverrides = {}): Promise<any> {
        try {
            const erc20 = await this.contracts.getERC20(this.ERC20Address);
            return await erc20.approve(spender, value, txOpts);
        }
        catch (error) {
            console.error('Error approving asset:', error);
        }
    }

    public async allowance(owner: Address, spender: Address): Promise<Uint256> {
        try {
            const erc20 = await this.contracts.getERC20(this.ERC20Address);
            return await erc20.allowance(owner, spender);
        }
        catch (error) {
            console.error('Error getting allowance:', error);
        }
    }

    public async name(): Promise<string> {
        try {
            const erc20 = await this.contracts.getERC20(this.ERC20Address);
            return await erc20.name();
        }
        catch (error) {
            console.error('Error getting name:', error);
        }
    }

    public async symbol(): Promise<string> {
        try {
            const erc20 = await this.contracts.getERC20(this.ERC20Address);
            return await erc20.symbol();
        }
        catch (error) {
            console.error('Error getting symbol:', error);
        }
    }

    public async decimals(): Promise<number> {
        try {
            const erc20 = await this.contracts.getERC20(this.ERC20Address);
            return await erc20.decimals();
        }
        catch (error) {
            console.error('Error getting decimals:', error);
        }
    }

    public async totalSupply(): Promise<Uint256> {
        try {
            const erc20 = await this.contracts.getERC20(this.ERC20Address);
            return await erc20.totalSupply();
        }
        catch (error) {
            console.error('Error getting total supply:', error);
        }
    }
}