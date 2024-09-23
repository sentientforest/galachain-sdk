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
import { TokenClass, TokenAllowance, TokenBalanceWithMetadata } from '@gala-chain/api'

// todo: temporarily duplicating these from their respective *.vue implementations
// working around TS compilation errors on production build, incorporating into overarching monorepo
export interface MintTokenProps {
  tokenAllowance?: { token: TokenClass; allowances: TokenAllowance[] }
  loading?: boolean
  disabled?: boolean
}

export interface MintTokenWithAllowanceProps {
  address?: string
  token?: TokenClass
  loading?: boolean
  disabled?: boolean
}

export interface TransferTokenProps {
    /** User token balance */
    tokenBalance?: TokenBalanceWithMetadata
    /** Submit button loading state */
    loading?: boolean
    /** Submit button disabled state */
    disabled?: boolean
  }