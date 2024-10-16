'use strict';
import { JVaultConfig, Address } from './utils/types/index';
import {
    OptionTradingAPI,
    VaultAPI
} from './api/index';
import fs from 'fs';
import path from 'path';
import { NetworkConfig } from './utils/types/index';

class JVault {
    public OptionTradingAPI: OptionTradingAPI;
    public VaultAPI: VaultAPI;
    public EOA: Address;
    public config: JVaultConfig;
    constructor(config: JVaultConfig) {
        this.config = this.initConfig(config);
        this.OptionTradingAPI = new OptionTradingAPI(this.config);
        this.VaultAPI = new VaultAPI(this.config);
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
        const filePath = path.join(__dirname, `/api/config/${networkName}.json`);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Network configuration file for ${networkName} not found in ` + filePath);
        }
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data) as NetworkConfig;
        } catch (error) {
            throw new Error(`Error reading the network config file: ${error.message}`);
        }
    }


}


export default JVault;
