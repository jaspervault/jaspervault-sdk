import { Provider } from '@ethersproject/providers';
import { Signer } from '@ethersproject/abstract-signer';
import { BigNumber, BytesLike } from 'ethers';
import { provider as Web3CoreProvider } from 'web3-core';


export { TransactionReceipt } from 'ethereum-types';

export interface JVaultConfig {
  EOA: Address;
  ethersProvider?: Provider;
  ethersSigner?: Signer;
  web3Provider?: Web3CoreProvider;
  network: string;
  isTest?: boolean;
  data?: NetworkConfig;
}

export interface SignedPrice {
  id: string;
  chain_id: number;
  product_type: number;
  option_asset: string;
  strike_price: number;
  strike_asset: string;
  strike_amount: string;
  lock_asset: string;
  lock_amount: string;
  expire_date: number;
  lock_date: number;
  option_type: number;
  premium_asset: string;
  premium_fee: string;
  timestamp: number;
  oracle_sign: string[];
}



export enum OptionType {
  CALL,
  PUT,
}

export enum LiquidateType {
  NotExercising,
  Exercising,
  ProfitTaking,
}


export interface JVaultOrder {
  id?: string;
  premiumVault?: Address;
  optionVault?: Address;
  optionType?: OptionType;
  optionWriter?: Address;
  amount?: BigNumber;
  underlyingAsset?: Address;
  lockAsset?: Address;
  lockAmount?: BigNumber;
  strikeAsset?: Address;
  strikeAmount?: BigNumber;
  premiumAsset?: Address;
  premium?: BigNumber;
  expiry?: Date;
  secondsToExpiry?: number;
  chainId?: number;
}

export interface BundlerOP {
  dest: Address;
  value: BigNumber;
  data: string[];
}

export interface Token {
  symbol: string;
  address: string;
  decimals: number;
  type: number;
}

export interface NetworkConfig {
  safeBlock: number;
  chainId: number;
  name: string;
  entryPoint: Address;
  uniswapRouterV2: Address;
  uniswapRouterV3: Address;
  eth: Address;
  weth: Address;
  pythPriceFeedAddr: Address;
  bundleUrl: Address;
  rpcUrl: string;
  tokens: Token[];
  pyth: string[][];
  contractData: {
    OptionModule: Address;
    OptionModuleV2: Address;
    EntryPoint: Address;
    DiamondCutFacet: Address;
    DiamondLoupeFacet: Address;
    OwnershipFacet: Address;
    Diamond: Address;
    PlatformFacet: Address;
    VaultFacet: Address;
    LendFacet: Address;
    PaymasterFacet: Address;
    VaultPaymaster: Address;
    VaultManageModule: Address;
    TradeModule: Address;
    IssuanceModule: Address;
    VaultFactory: Address;
    OptionService: Address;
    PriceOracle: Address;
  };
}
export interface TransactionOverrides {
  gasLimit?: BigNumber | Promise<BigNumber>;
  gasPrice?: BigNumber | Promise<BigNumber>;
  maxFeePerGas?: BigNumber | Promise<BigNumber>;
  maxPriorityFeePerGas?: BigNumber | Promise<BigNumber>;
  nonce?: BigNumber | Promise<BigNumber>;
  type?: number;
  customData?: Record<string, any>;
  ccipReadEnabled?: boolean;
}
export interface OptionOrderDetail {
  id: string;
  holder: string;
  liquidateMode: number;
  writer: string;
  lockAssetType: number;
  recipient: string;
  lockAsset: string;
  underlyingAsset: string;
  strikeAsset: string;
  lockAmount: string;
  strikeAmount: string;
  expirationDate: string;
  lockDate: string;
  underlyingNftID: string;
  quantity: string;
}

export interface OptionOrder {
  transactionHash: string;
  timestamp: string;
  orderDetail: OptionOrderDetail | null;
  orderId: string;
  holderWallet: string;
  writerWallet: string;
}


export type Address = string;

export type Uint256 = BigNumber;

export type Bytes = BytesLike;

export type Uint64 = BigNumber;
