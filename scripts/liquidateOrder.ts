import { JVault } from '../src';
import { JVaultConfig } from '../src/utils/types/index';
import { ethers } from 'ethers';
import { LiquidateType } from '../src/utils/types/common';
import * as dotenv from 'dotenv';

let config_holder: JVaultConfig;
dotenv.config();


config_holder = {
    ethersProvider: new ethers.providers.JsonRpcProvider(
        'https://base-mainnet.g.alchemy.com/v2/O6KV2NWJZqZZELxRphDj0OaGu0mQ5fha'),
    ethersSigner: new ethers.Wallet(process.env.PRIVATE_KEY_HOLDER,
        new ethers.providers.JsonRpcProvider('https://base-mainnet.g.alchemy.com/v2/O6KV2NWJZqZZELxRphDj0OaGu0mQ5fha')),
    network: 'base',
};


const jVault_holder: JVault = new JVault(config_holder);


async function main() {
    await liquidateOrder();
}

async function liquidateOrder() {
    console.log('Holder Signer:' + await config_holder.ethersSigner.getAddress());
    let vaults = await jVault_holder.VaultAPI.getWalletToVault(await config_holder.ethersSigner.getAddress());
    console.log(`vaults: ${vaults}`);
    let tx = await jVault_holder.OptionTradingAPI.liquidateOrder({
        id: "2",
        optionType: 1,
        optionVault: vaults[2],
    },
        LiquidateType.NotExercising
    );
    console.log(`tx: ${tx}`);
}
main().catch(error => {
    console.error(error);
    // process.exitCode = 1;
});
