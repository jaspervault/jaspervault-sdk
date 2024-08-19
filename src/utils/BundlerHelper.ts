import { SimpleAccountAPI } from '@account-abstraction/sdk';
import { JVaultConfig, Address, BundlerOP } from '../utils/types/index';
import { EntryPointWrapper, VaultWrapper, VaultFactoryWrapper } from '../wrappers/';
import { TransactionResponse, TransactionReceipt } from '@ethersproject/providers';
import { AxiosResponse } from 'axios';
import axios from 'axios';
import sleep from 'sleep-promise';
import { BigNumber } from 'ethers';
import { TransactionOverrides } from '@jaspervault/contracts-v2/dist/typechain/';

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
      op_arr.forEach(element => {
         dest.push(element.dest);
         value.push(element.value);
         func.push(element.data);
      });
      const vaultCode = await this.config.ethersProvider.getCode(vault);
      if (vaultCode == '0x') {
         throw new Error('Vault not exist');
      }
      const Vault = new VaultWrapper(this.config.ethersSigner, vault);
      return await Vault.executeBatch(dest, value, func, false, txOpts);
   }
   async sendtoBundler(vault: Address, vaultIndex: number, op_arr: BundlerOP[]) {
      // let client = new HttpRpcClient(settings.bundleUrl,settings.entryPoint, settings.chainId)
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

      // console.log(nonce, "nonce")

      const code = await this.config.ethersProvider.getCode(vault);

      let initCode = '0x';
      const tokenUrl = `${this.config.data.bundleUrl}/tyche/api/gasPrice`;
      console.log('tokenUrl', tokenUrl);
      const feeData = await axios.get(tokenUrl);

      if (!feeData || !feeData.data || !feeData.data.data) {
         console.log('<error order>', feeData);
         return undefined;
      }

      const {
         suggesMaxFeePerGas, suggesMaxPriorityFeePerGas,
      } = feeData.data.data.data;
      if (code == '0x') {
         initCode = `${this.config.data.contractData.VaultFactory}5fbfb9cf${String(await this.config.ethersSigner.getAddress()).substring(2).padStart(64, '0')}${((Number(vaultIndex)).toString(16)).padStart(64, '0')}`;
      }

      const Vault = new VaultWrapper(this.config.ethersSigner, vault);

      const calldata = await Vault.executeBatch(dest, value, func, true);

      // let calldata = '0x'
      // 获取当前小费
      // let feeData = await provider.getFeeData()

      const unsignOp = {
         sender: vault,
         nonce: nonce,
         initCode: initCode,
         callData: calldata,
         callGasLimit: 4000000,
         verificationGasLimit: 1500000,
         maxFeePerGas: BigNumber.from(suggesMaxFeePerGas).mul(3).div(2),
         maxPriorityFeePerGas: BigNumber.from(suggesMaxPriorityFeePerGas).mul(11).div(10),
         // paymasterAndData: "0x",
         paymasterAndData: this.config.data.contractData.VaultPaymaster,
         //   paymasterAndData:"0x647f1eA2ed929D2D0dC0783c1810a57501C38e36",
         preVerificationGas: 4500000,
         signature: '',
      };

      // verificationGasLimit*3 + preVerificationGas + callGasLimit
      // (500000*3 +90000+9000000) *1855652560640

      // var gas= await ethers.provider.estimateGas({
      //    from:"0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      //    to: "0x7d1679E9610d5C1737f074882753497bBeBBbD80",
      //    data: calldata,

      //    // 1 ether
      //    value: 0
      // })
      // console.log("gas","--------------",gas)
      // return
      // maxFeePerGas
      // console.log("hash", await accountAPI.getUserOpHash(unsignOp))

      const op = await this.accountAPI.signUserOp(unsignOp);
      console.log('<op>', op);

      op.sender = await op.sender;
      op.maxFeePerGas = Number(await op.maxFeePerGas);
      op.maxPriorityFeePerGas = Number(await op.maxPriorityFeePerGas);
      op.maxFeePerGas = Number(op.maxFeePerGas);
      op.nonce = Number(await op.nonce);
      op.verificationGasLimit = Number(op.verificationGasLimit);
      op.signature = await op.signature;
      let tx: TransactionReceipt = undefined;

      console.log('op', op);
      // tx = await this.EntryPointWrapper.handleOps([op], await this.config.ethersSigner.getAddress())
      // console.log("tx", tx)
      // return tx
      const data = {
         'address': this.config.data.contractData.EntryPoint,
         'method': 'handleOps',
         'args': {
            'ops': [
               op,
            ],
            'beneficiary': '0x2E4621E682272680AEAB78f48Fc0099CED79e7d6',
         },
      };
      console.log('<post order>');

      const order = await axios.post(`${this.config.data.bundleUrl}/tyche/api/transact`, data);
      if (!order || !order.data || !order.data.data) {
         console.log('<order error>', order.data);
         return undefined;
      }
      console.log('<order Id>', order.data.data.id);
      const hash = await this.getOperationHash(order.data.data.id, 300, 2);
      // await hash.wait(1)
      console.log('<tx hash>', hash.hash);
      tx = await this.config.ethersProvider.getTransactionReceipt(String(hash.hash));
      console.log('<TransactionReceipt>', tx);
      await hash.wait(2);
      return hash.hash;
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
