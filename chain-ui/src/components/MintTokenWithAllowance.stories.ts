/*
 * Copyright (c) Gala Games Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Meta, StoryObj } from '@storybook/vue3'
import { action } from '@storybook/addon-actions'
import MintTokenWithAllowance from './MintTokenWithAllowance.vue'
import { createValidChainObject, TokenClass } from '@gala-chain/api';
import BigNumber from 'bignumber.js';

const meta: Meta<typeof MintTokenWithAllowance> = {
  component: MintTokenWithAllowance,
  args: {
    onSubmit: action('submit')
  }
}

export default meta
type Story = StoryObj<typeof MintTokenWithAllowance>

const token = await createValidChainObject(TokenClass, {
  additionalKey: 'none',
  authorities: ['client|test'],
  category: 'Unit',
  collection: 'GALA',
  decimals: 8,
  description: 'GALA token',
  image: 'https://app.gala.games/_nuxt/img/GALA-icon.b642e24.png',
  isNonFungible: false,
  knownMintAllowanceSupply: new BigNumber('5000000000'),
  knownMintSupply: new BigNumber('50000000000'),
  maxCapacity: new BigNumber('50000000000'),
  maxSupply: new BigNumber('50000000000'),
  name: 'GALA',
  network: 'GC',
  symbol: 'GALA',
  totalBurned: new BigNumber('5000'),
  totalMintAllowance: new BigNumber('50000000000'),
  totalSupply: new BigNumber('50000000000'),
  type: 'none'
});

export const Primary: Story = {
  args: {
    token,
    address: 'client|test',
    loading: false,
    disabled: false
  }
}

export const Empty: Story = {
  args: {
    token: undefined,
    address: 'client|test',
    loading: false,
    disabled: false
  }
}
