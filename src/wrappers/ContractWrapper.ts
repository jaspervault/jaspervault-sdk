/*
  Copyright 2020 Set Labs Inc.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

'use strict';

import { Signer } from '@ethersproject/abstract-signer';
import { Address } from '../utils/types';
import { VaultManageModule, OptionModule, IssuanceModule } from '@jaspervault/contracts-v2/dist/typechain/contracts/modules/';
import {
  VaultManageModule__factory,
  OptionModule__factory,
  OptionModuleV2__factory,
  OptionModuleV4__factory,
  IssuanceModule__factory
} from '@jaspervault/contracts-v2/dist/typechain/factories/contracts/modules/';

import { VaultFactory__factory, VaultPaymaster__factory, PriceOracle__factory, Manager__factory } from '@jaspervault/contracts-v2/dist/typechain/factories/contracts/';

import { EntryPoint__factory } from '@jaspervault/contracts-v2/dist/typechain/factories/contracts/eip/4337/core/';
import { IERC20__factory } from '@jaspervault/contracts-v2/dist/typechain/factories/contracts/interfaces/external';
import { Vault__factory } from '@jaspervault/contracts-v2/dist/typechain/factories/contracts/Vault.sol';

import { OptionService__factory } from '@jaspervault/contracts-v2/dist/typechain/factories/contracts/service/';



export default class ContractWrapper {
  private signer: Signer;

  public constructor(signer: Signer) {
    this.signer = signer;
  }

  public getVaultPaymaster(
    vaultPaymasterAddress: Address
  ): VaultPaymaster__factory {
    return VaultPaymaster__factory.connect(vaultPaymasterAddress, this.signer);
  }

  public getVault(
    vaultAddress: Address
  ): Vault__factory {
    return Vault__factory.connect(vaultAddress, this.signer);
  }

  public getEntryPoint(
    entryPointAddress: Address
  ): EntryPoint__factory {
    return EntryPoint__factory.connect(entryPointAddress, this.signer);
  }

  public getVaultManageModule(
    vaultManageModuleAddress: Address
  ): VaultManageModule {
    return VaultManageModule__factory.connect(vaultManageModuleAddress, this.signer);
  }


  public getOptionModule(
    optionModuleAddress: Address
  ): OptionModule {
    return OptionModule__factory.connect(optionModuleAddress, this.signer);
  }

  public getOptionModuleV2(
    optionModuleV2Address: Address
  ): OptionModule {
    return OptionModuleV2__factory.connect(optionModuleV2Address, this.signer);
  }

  public getOptionModuleV4(
    optionModuleV4Address: Address
  ) {
    return OptionModuleV4__factory.connect(optionModuleV4Address, this.signer);
  }

  public getIssuanceModule(
    issuanceModuleAddress: Address
  ): IssuanceModule {
    return IssuanceModule__factory.connect(issuanceModuleAddress, this.signer);
  }

  public getOptionService(
    optionServiceAddress: Address
  ): OptionService__factory {
    return OptionService__factory.connect(optionServiceAddress, this.signer);
  }
  public getVaultFactory(
    vaultFactoryAddress: Address
  ): VaultFactory__factory {
    return VaultFactory__factory.connect(vaultFactoryAddress, this.signer);
  }
  public getPriceOracle(
    priceOracleAddress: Address
  ): PriceOracle__factory {
    return PriceOracle__factory.connect(priceOracleAddress, this.signer);
  }
  public getManager(
    managerAddress: Address
  ): Manager__factory {
    return Manager__factory.connect(managerAddress, this.signer);
  }
  public getERC20(
    erc20Address: Address
  ): IERC20__factory {
    return IERC20__factory.connect(erc20Address, this.signer);
  }

}

