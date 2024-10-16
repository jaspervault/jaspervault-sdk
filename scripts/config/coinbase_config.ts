import { config } from 'dotenv';
config();
export class CoinbaseConfig {
    bundlerUrl: string;
    entryPoint: string;
    constructor(data: { bundlerUrl: string, entryPoint: string }) {
        this.bundlerUrl = data.bundlerUrl;
        this.entryPoint = data.entryPoint;
    }

}
const coinbaseConfig = new CoinbaseConfig({
    bundlerUrl: process.env.COINBASE_BUNDLERURL || '',
    entryPoint: process.env.ENTRYPOINT_06 || ''
})

export { coinbaseConfig }; 