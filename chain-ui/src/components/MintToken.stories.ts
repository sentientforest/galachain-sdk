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
import MintToken from './MintToken.vue'
import { createValidChainObject, TokenAllowance, TokenClass } from '@gala-chain/api'
import BigNumber from 'bignumber.js'

const meta: Meta<typeof MintToken> = {
  component: MintToken,
  args: {
    onSubmit: action('submit')
  }
};

export default meta
type Story = StoryObj<typeof MintToken>

const tokenAllowance = {
  token: await createValidChainObject(TokenClass, {
    additionalKey: 'none',
    authorities: [],
    category: 'Unit',
    collection: 'GALA',
    decimals: 8,
    description: 'GALA token',
    image: 'https://app.gala.games/_nuxt/img/GALA-icon.b642e24.png',
    isNonFungible: false,
    maxCapacity: new BigNumber('50000000000'),
    maxSupply: new BigNumber('50000000000'),
    name: 'GALA',
    network: 'GC',
    symbol: 'GALA',
    totalBurned: new BigNumber('0'),
    totalMintAllowance: new BigNumber('0'),
    totalSupply: new BigNumber('50000000000'),
    type: 'none'
  }),
  allowances: [
    await createValidChainObject(TokenAllowance, {
      additionalKey: 'none',
      allowanceType: 4,
      category: 'Unit',
      collection: 'GALA',
      created: 1719413534107,
      expires: 0,
      grantedBy: '',
      grantedTo: '',
      instance: new BigNumber('0'),
      quantity: new BigNumber('1000'),
      quantitySpent: new BigNumber('0'),
      type: 'none',
      uses: new BigNumber('1000'),
      usesSpent: new BigNumber('0')
    })
  ]
}

export const Primary: Story = {
  args: {
    tokenAllowance,
    loading: false,
    disabled: false
  }
};

export const Empty: Story = {
  args: {
    tokenAllowance: undefined,
    loading: false,
    disabled: false
  }
}
