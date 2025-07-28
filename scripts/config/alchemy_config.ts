import { config } from 'dotenv';
config();

export class AlchemyConfig {
    apiKey: string;
    gasManagerPolicyId: string;

    constructor(data: { apiKey: string, gasManagerPolicyId: string }) {
        this.apiKey = data.apiKey;
        this.gasManagerPolicyId = data.gasManagerPolicyId;
    }
}

const alchemyConfig = new AlchemyConfig({
    apiKey: process.env.ALCHEMY_API_KEY || '',
    gasManagerPolicyId: process.env.ALCHEMY_GAS_MANAGER_POLICY_ID || ''
});

export { alchemyConfig }; 