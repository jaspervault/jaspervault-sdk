import { config } from 'dotenv';
config();
export class BitlayerBundlerConfig {
    projectAPIKey: string;
    paymasterUrl: string;
    bundlerUrl: string;
    entryPoint: string;
    constructor(data: { projectAPIKey: string, paymasterUrl: string, bundlerUrl: string, entryPoint: string }) {
        this.projectAPIKey = data.projectAPIKey;
        this.paymasterUrl = data.paymasterUrl;
        this.bundlerUrl = data.bundlerUrl;
        this.entryPoint = data.entryPoint;
    }

}
const bitlayerBundlerConfig = new BitlayerBundlerConfig({
    projectAPIKey: process.env.BITLAYERBUNDLER_PROJECT_APIKEY || '',
    paymasterUrl: process.env.BITLAYERBUNDLER_PAYMASTERURL || '',
    bundlerUrl: process.env.BITLAYERBUNDLER_BUNDLERURL || '',
    entryPoint: process.env.ENTRYPOINT_06 || ''
})

export { bitlayerBundlerConfig }; 