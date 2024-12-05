'use strict';
import { JVaultConfig, Address } from './utils/types/index';
import {
    OptionTradingAPI,
    VaultAPI,
    BlockchainAPI
} from './api/index';

import { NetworkConfig, Token } from './utils/types/index';

// Import configuration files
import arbitrumConfig from './api/config/arbitrum.json';
import baseUatConfig from './api/config/base_uat.json';
import baseConfig from './api/config/base.json';
import bitlayerConfig from './api/config/bitlayer.json';
import bnbConfig from './api/config/bnb.json';
import seiConfig from './api/config/sei.json';

// Helper function to convert token format
function convertTokens(tokens: any[]): Token[] {
    return tokens.map(token => ({
        ...token,
        symbol: token.name, // Assuming 'name' can be used as 'symbol'
        decimals: 18, // Default to 18 decimals, adjust if needed
    }));
}

// Helper function to ensure NetworkConfig compatibility
function ensureNetworkConfig(config: any): NetworkConfig {
    return {
        ...config,
        tokens: convertTokens(config.tokens),
        pythPriceFeedAddr: config.pythPriceFeedAddr || config.pythAddr || '',
        rpcUrl: config.rpcUrl || '',
        subgraphUrl: config.subgraphUrl || '',
    };
}

class JVault {
    public OptionTradingAPI: OptionTradingAPI;
    public VaultAPI: VaultAPI;
    public BlockchainAPI: BlockchainAPI;
    public EOA: Address;
    public config: JVaultConfig;
    constructor(config: JVaultConfig) {
        this.config = this.initConfig(config);
        this.OptionTradingAPI = new OptionTradingAPI(this.config);
        this.VaultAPI = new VaultAPI(this.config);
        this.BlockchainAPI = new BlockchainAPI(this.config);
        this.EOA = this.config.EOA;
    }
    public initConfig(config: JVaultConfig): JVaultConfig {
        if (!config.ethersProvider) {
            throw new Error('Ethers provider is required');
        }
        const network: NetworkConfig = JVault.readNetworkConfig(config.network);
        config.data = network;
        return config;
    }

    static readNetworkConfig(networkName: string): NetworkConfig {
        const configs: { [key: string]: NetworkConfig } = {
            arbitrum: ensureNetworkConfig(arbitrumConfig),
            base_uat: ensureNetworkConfig(baseUatConfig),
            base: ensureNetworkConfig(baseConfig),
            bitlayer: ensureNetworkConfig(bitlayerConfig),
            bnb: ensureNetworkConfig(bnbConfig),
            sei: ensureNetworkConfig(seiConfig),
        };

        if (!(networkName in configs)) {
            throw new Error(`Network configuration for ${networkName} not found`);
        }

        return configs[networkName];
    }
}

export default JVault;
