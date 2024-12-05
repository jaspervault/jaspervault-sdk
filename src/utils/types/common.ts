import { Provider } from '@ethersproject/providers';
import { Signer } from '@ethersproject/abstract-signer';
import { BigNumber, BytesLike } from 'ethers';
import { provider as Web3CoreProvider } from 'web3-core';
import { TransactionHandler } from '../JaspervaultTransactionHandler';
import { IOptionModuleV2 } from '@jaspervault/contracts-v2/dist/types/typechain/contracts/modules/OptionModuleV2';

export { TransactionReceipt } from 'ethereum-types';

export interface JVaultStatus {
  isLocked: boolean;
  modules: Address[];
  tokens: Address[];
  type: number;
}

export interface JVaultConfig {
  EOA: Address;
  ethersProvider?: Provider;
  ethersSigner?: Signer;
  web3Provider?: Web3CoreProvider;
  network: string;
  isTest?: boolean;
  data?: NetworkConfig;
  transactionHandler?: TransactionHandler;
  gasSettings?: {
    maxFeePerGas: BigNumber;
    maxPriorityFeePerGas: BigNumber;
  };
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
  optionVaultIndex?: number;
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
  nftWaiver?: Address;
  nftId?: BigNumber;
  premiumSign?: IOptionModuleV2.PremiumOracleSignStruct;
  depositData?: DepositData;
  paymasterSettings?: {
    paymaster: Address;
    paymasterFee: BigNumber;
  };
}
export interface DepositData {
  vault: Address;
  amount: BigNumber;
  token: Address;
  isERC20: boolean;
}

export interface BundlerEstimate {
  'sender': Address;
  'nonce': string;
  'initCode': string;
  'callData': string;
  'signature': string;

}

export interface BundlerOP {
  dest: Address;
  value: BigNumber;
  data: string;
}

export interface Token {
  symbol: string;
  address: string;
  decimals: number;
  type: number;
  id: string;
}
export interface JSBTId {
  key: string;
  value: number;
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
  quoteAsset: string;
  pythPriceFeedAddr: Address;
  aproEndpoint: Address;
  optionQuotesUrl: string;
  rpcUrl: string;
  subgraphUrl: string;
  tokens: Token[];
  pyth: string[][];
  apro: Token[];
  defaultFeeData: {
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  };
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
    Manager: Address;
    OptionLiquidateService: Address;
  };
  nftWaiver: {
    JSBT: Address;
    JSBTIds: JSBTId[];
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
  value?: BigNumber | Promise<BigNumber>;
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
