import { config } from 'dotenv';
config();
export class ParticalConfig {
    projectUuid: string;
    projectKey: string;
    paymasterUrl: string;
    bundlerUrl: string;
    entryPoint: string;
    constructor(data: { projectUuid: string, projectKey: string, paymasterUrl: string, bundlerUrl: string, entryPoint: string }) {
        this.projectUuid = data.projectUuid;
        this.projectKey = data.projectKey;
        this.paymasterUrl = data.paymasterUrl;
        this.bundlerUrl = data.bundlerUrl;
        this.entryPoint = data.entryPoint;
    }

}
const particalConfig = new ParticalConfig({
    projectUuid: process.env.PARTICAL_PROJECTUUID || '',
    projectKey: process.env.PARTICAL_PROJECTKEY || '',
    paymasterUrl: process.env.PARTICAL_PAYMASTERURL || '',
    bundlerUrl: process.env.PARTICAL_BUNDLERURL || '',
    entryPoint: process.env.ENTRYPOINT_06 || ''
})

export { particalConfig }; 