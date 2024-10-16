import { SimpleAccountAPI } from '@account-abstraction/sdk';
import { JVaultConfig, Address, BundlerOP, BundlerEstimate, NetworkConfig } from '../utils/types/index';
import { EntryPointWrapper, VaultWrapper, VaultFactoryWrapper } from '../wrappers/';
import { TransactionResponse } from '@ethersproject/providers';
import { AxiosResponse } from 'axios';
import axios from 'axios';
import sleep from 'sleep-promise';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';
import { ethers } from 'ethers';


class BundlerHelper {
   private accountAPI: SimpleAccountAPI;
   private config: JVaultConfig;
   private EntryPointWrapper: EntryPointWrapper;
   private VaultFactoryWrapper: VaultFactoryWrapper;

   constructor(config: JVaultConfig) {
      this.config = config;
      this.EntryPointWrapper = new EntryPointWrapper(config.ethersSigner, config.data.contractData.EntryPoint);
      this.VaultFactoryWrapper = new VaultFactoryWrapper(config.ethersSigner, config.data.contractData.VaultFactory);
   }


   async getSender(index: number): Promise<Address> {
      return await this.VaultFactoryWrapper.getAddress(await this.config.ethersSigner.getAddress(), index);
   }

   async sendtoVault(
      vault: Address,
      op_arr: BundlerOP[],
      txOpts: TransactionOverrides = {}
   ) {
      const dest = [];
      const value = [];
      const func = [];
      let vaule_tx = ethers.constants.Zero;
      op_arr.forEach(element => {
         dest.push(element.dest);
         value.push(element.value);
         vaule_tx = vaule_tx.add(element.value);
         func.push(element.data);
      });
      const vaultCode = await this.config.ethersProvider.getCode(vault);
      if (vaultCode == '0x') {
         throw new Error('Vault not exist');
      }
      const Vault = new VaultWrapper(this.config.ethersSigner, vault);
      txOpts.value = vaule_tx;
      return await Vault.executeBatch(dest, value, func, false, txOpts);
   }
   toHex(n) {
      return '0x' + String(Number(n).toString(16));
   }
   async estimateUserOperationGas(params: BundlerEstimate) {
      const paymasterUrl = 'https://bundler.particle.network/#eth_estimateUserOperationGas';
      const options = {
         'method': 'eth_estimateUserOperationGas',
         'params': [
            // partial user operation
            params,
            '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789',
         ],
         'id': 1,
         'jsonrpc': '2.0',
         'chainId': this.config.data.chainId,
      };
      const res = await axios.post(paymasterUrl, options);
      if (res.data.error) {
         console.log('eth_estimateUserOperationGas error: ', res.data);
         return;
      }
   }
   async sendtoBundler(vault: Address, vaultIndex: number, op_arr: BundlerOP[], networkConfig?: NetworkConfig) {
      const chainID = this.config.data.chainId;
      const dest = [];
      const value = [];
      const func = [];
      op_arr.forEach(element => {
         dest.push(element.dest);
         value.push(element.value);
         func.push(element.data);
      });
      this.accountAPI = new SimpleAccountAPI({
         provider: this.config.ethersProvider,
         entryPointAddress: this.config.data.contractData.EntryPoint,
         owner: this.config.ethersSigner,
         factoryAddress: this.config.data.contractData.VaultFactory,
         index: vaultIndex,
      });
      const nonce = await this.EntryPointWrapper.getNonce(vault, 0);
      let initCode = '0x';
      const Vault = new VaultWrapper(this.config.ethersSigner, vault);
      const calldata = await Vault.executeBatch(dest, value, func, true);
      // const feeData: FeeData = await this.config.ethersProvider.getFeeData();
      // const {
      //    maxPriorityFeePerGas, lastBaseFeePerGas
      // } = feeData
      const code = await this.config.ethersSigner.provider.getCode(vault);

      if (code == '0x') {
         initCode = `${networkConfig.contractData.VaultFactory}5fbfb9cf${String(await this.config.ethersSigner.getAddress()).substring(2).padStart(64, '0')}${String((Number(vaultIndex)).toString(16)).padStart(64, '0')}`;
       }
      const unsignOp = {
         sender: vault,
         nonce: nonce,
         initCode: initCode,
         callData: calldata,
         callGasLimit: 3500000,
         verificationGasLimit: 500000,
         maxFeePerGas: ethers.utils.parseUnits('0.05', 'gwei'),
         maxPriorityFeePerGas: ethers.utils.parseUnits('0.05', 'gwei'),
         // paymasterAndData: "0x",
         paymasterAndData: '0x',
         preVerificationGas: 500000,
         signature: '0x',
      };
      const projectUuid = '47ad2d9c-2271-4c27-a4e1-6856db7ffc76';
      const projectKey = 'c6fQ4cVGOOV5MWIPB7wCksHxMINtQhEAPHPRswKd';
      const entryPoint = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
      const paymasterUrl = 'https://paymaster.particle.network';
      const userOp = {
         'sender': unsignOp.sender,
         'nonce': this.toHex(await unsignOp.nonce),
         'initCode': unsignOp.initCode,
         'callData': await unsignOp.callData,
         'callGasLimit': this.toHex(unsignOp.callGasLimit),
         'verificationGasLimit': this.toHex(unsignOp.verificationGasLimit),
         'maxFeePerGas': this.toHex(unsignOp.maxFeePerGas),
         'maxPriorityFeePerGas': this.toHex(unsignOp.maxPriorityFeePerGas),
         'paymasterAndData': unsignOp.paymasterAndData,
         'preVerificationGas': this.toHex(unsignOp.preVerificationGas),
         'signature': unsignOp.signature,
      };
      let res = await axios.post(paymasterUrl,
         {
            method: 'pm_sponsorUserOperation',
            params: [userOp, entryPoint],
         },
         {
            params: {
               chainId: chainID,
               projectUuid: projectUuid,
               projectKey: projectKey,
            },
         }
      );
      if (!res || !res.data || !res.data.result || !res.data.result.paymasterAndData) {
         console.log(res.data, 'pm_sponsorUserOperation fail');
      }

      userOp.paymasterAndData = res.data.result.paymasterAndData;
      console.log(userOp);
      const op = await this.accountAPI.signUserOp(userOp);

      const options = {
         'method': 'eth_sendUserOperation',
         'params': [{
            'sender': await op.sender,
            'nonce': await op.nonce,
            'initCode': await op.initCode,
            'callData': await op.callData,
            'callGasLimit': await op.callGasLimit,
            'verificationGasLimit': await op.verificationGasLimit,
            'maxFeePerGas': op.maxFeePerGas,
            'maxPriorityFeePerGas': op.maxPriorityFeePerGas,
            'paymasterAndData': await op.paymasterAndData,
            'preVerificationGas': await op.preVerificationGas,
            'signature': await op.signature,
         }, entryPoint],
         'id': 1,
         'jsonrpc': '2.0',
         'chainId': chainID,
      };
      console.log(options);
      const bundlerUrl = 'https://bundler.particle.network/#eth_sendUserOperation';
      res = await axios.post(bundlerUrl, options);
      if (res.data.error) {
         console.log('eth_sendUserOperation error: ', res.data);
         // var dataField = JSON.parse(res.data.error.message.match(/{.*?}$/)[0]).error.data;
         // console.log("particle eth_sendUserOperation parseRevertReason: ", parseRevertReason(dataField))
         return;
      }
      const hash = await this.getUserOpByHash(res);
      await hash.wait(3);
      console.log('<tx hash>', hash.hash);
      return hash.hash;
   }

   async getUserOpByHash(res, timeout = 30, interval = 2) {
      const params = {
         'method': 'eth_getUserOperationByHash',
         'params': [
            res.data.result,
         ],
         'id': 1,
         'jsonrpc': '2.0',
         'chainId': this.config.data.chainId,
      };
      const tokenUrl = 'https://bundler.particle.network/#eth_getUserOperationByHash';

      let hash;
      const endtime = Date.now() + timeout * 1000;
      let transaction;
      while (Date.now() < endtime) {
         res = await axios.post(tokenUrl, params);
         //  console.log("res",  await res.data)
         if (res && res.data && res.data.result && res.data.result.transactionHash) {
            hash = res.data.result.transactionHash;
            while (!transaction) {
               transaction = await this.config.ethersProvider.getTransaction(hash);
               await sleep(500);
            }
            break;
         }
         await new Promise(resolve => setTimeout(resolve, interval * 1000));

      }
      return await this.config.ethersProvider.getTransaction(hash);
   }

   async getOperationHash(orderID: string, timeout: number, interval: number) {
      let orderResponse: AxiosResponse = undefined;
      let hash: string = undefined;
      const endtime = Date.now() + timeout * 1000;
      const tokenUrl = `${this.config.data.bundleUrl}/tyche/api/order/get`;
      let transaction: TransactionResponse = undefined;
      while (Date.now() < endtime) {
         // console.log("order-----------------------------------", orderID)
         const data = {
            'orderID': String(orderID),
         };
         orderResponse = await axios.post(tokenUrl, data);
         // console.log("orderResponse", orderResponse.data)

         if (orderResponse && orderResponse.data && orderResponse.data.data && orderResponse.data.data.txHash) {
            hash = orderResponse.data.data.txHash;
            while (!transaction) {
               transaction = await this.config.ethersProvider.getTransaction(hash);
               await sleep(500);
            }
            break;
         }
         await new Promise(resolve => setTimeout(resolve, interval * 1000));

      }
      return await this.config.ethersProvider.getTransaction(hash);
   }

}
export default BundlerHelper;
