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
import {
  BatchBridgeTokenInDto,
  BatchFillTokenSwapDto,
  BatchMintTokenDto,
  BridgeTokenOutDto,
  BurnTokensDto,
  ChainCallDTO,
  ChainError,
  ChainId,
  ChainObject,
  ErrorCode,
  FeeGateCodes,
  FillTokenSwapDto,
  FulfillMintAllowanceDto,
  FulfillMintDto,
  HighThroughputGrantAllowanceDto,
  HighThroughputMintTokenDto,
  MintTokenDto,
  MintTokenWithAllowanceDto,
  OracleBridgeFeeAssertion,
  OracleBridgeFeeAssertionDto,
  OracleDefinition,
  OraclePriceAssertion,
  PaymentRequiredError,
  RequestTokenBridgeOutDto,
  TerminateTokenSwapDto,
  TransferTokenDto,
  ValidationFailedError
} from "@gala-chain/api";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { authorize } from "../contracts";
import { KnownOracles } from "../oracle";
import { GalaChainContext } from "../types";
import { getObjectByKey, putChainObject } from "../utils";
import { galaFeeGate, writeUsageAndCalculateFeeAmount } from "./galaFeeGate";
import { payFeeFromCrossChannelAuthorization } from "./payFeeFromCrossChannelAuthorization";
import { payFeeImmediatelyFromBalance } from "./payFeeImmediatelyFromBalance";

export interface IRequestOwner {
  owner?: string | undefined;
}

export function extractUniqueOwnersFromRequests(ctx: GalaChainContext, requests: IRequestOwner[]) {
  const owners = requests.map((r) => r.owner ?? ctx.callingUser);

  return Array.from(new Set(owners));
}

export interface IRequestUser {
  user?: string | undefined;
}

export function extractUniqueUsersFromRequests(ctx: GalaChainContext, requests: IRequestUser[]) {
  const users: string[] = requests.map((r) => r.user ?? ctx.callingUser);

  return Array.from(new Set(users));
}

export async function batchBridgeTokenInFeeGate(ctx: GalaChainContext, dto: BatchBridgeTokenInDto) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.BatchBridgeTokenIn });
}

export async function batchFillTokenSwapFeeGate(ctx: GalaChainContext, dto: BatchFillTokenSwapDto) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.BatchFillTokenSwap });
}

export async function batchMintTokenFeeGate(ctx: GalaChainContext, dto: BatchMintTokenDto) {
  const owners: string[] = extractUniqueOwnersFromRequests(ctx, dto.mintDtos);

  for (const owner of owners) {
    await galaFeeGate(ctx, {
      feeCode: FeeGateCodes.BatchMintToken
      // v1 fees requires only callingUser identities pay fees
      // uncomment below to require benefiting / initiating user to pay,
      // regardless of who executes the method
      // activeUser: owner
    });
  }

  return Promise.resolve();
}

export async function bridgeTokenOutFeeGate(ctx: GalaChainContext, dto: BridgeTokenOutDto) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.BridgeTokenOut });
}

export async function burnTokensFeeGate(ctx: GalaChainContext, dto: BurnTokensDto) {
  return galaFeeGate(ctx, {
    feeCode: FeeGateCodes.BurnTokens
    // v1 fees requires only callingUser identities pay fees
    // activeUser: dto.owner ?? ctx.callingUser
  });
}

export async function terminateTokenSwapFeeGate(ctx: GalaChainContext, dto: TerminateTokenSwapDto) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.TerminateTokenSwap });
}

export async function highThroughputMintRequestFeeGate(
  ctx: GalaChainContext,
  dto: HighThroughputMintTokenDto
) {
  return galaFeeGate(ctx, {
    feeCode: FeeGateCodes.HighThroughputMintRequest,
    activeUser: dto.owner ?? ctx.callingUser
  });
}

export async function highThroughputMintFulfillFeeGate(ctx: GalaChainContext, dto: FulfillMintDto) {
  const owners: string[] = extractUniqueOwnersFromRequests(ctx, dto.requests);

  for (const owner of owners) {
    await galaFeeGate(ctx, {
      feeCode: FeeGateCodes.HighThroughputMintFulfill,
      activeUser: owner
    });
  }

  return Promise.resolve();
}

export async function highThroughputMintAllowanceRequestFeeGate(
  ctx: GalaChainContext,
  dto: HighThroughputGrantAllowanceDto
) {
  const users: string[] = extractUniqueUsersFromRequests(ctx, dto.quantities);

  for (const user of users) {
    await galaFeeGate(ctx, {
      feeCode: FeeGateCodes.HighThroughputMintAllowanceRequest,
      activeUser: user
    });
  }

  return Promise.resolve();
}

export async function highThroughputMintAllowanceFulfillFeeGate(
  ctx: GalaChainContext,
  dto: FulfillMintAllowanceDto
) {
  const owners: string[] = extractUniqueOwnersFromRequests(ctx, dto.requests);

  for (const owner of owners) {
    await galaFeeGate(ctx, {
      feeCode: FeeGateCodes.HighThroughputMintAllowanceFulfill,
      activeUser: owner
    });
  }

  return Promise.resolve();
}

export async function mintTokenFeeGate(ctx: GalaChainContext, dto: MintTokenDto) {
  return galaFeeGate(ctx, {
    feeCode: FeeGateCodes.MintToken
    // v1 fees requires only callingUser identities pay fees
    // uncomment below to require benefiting / initiating user to pay,
    // regardless of who executes the method
    // activeUser: dto.owner ?? ctx.callingUser
  });
}

export async function mintTokenWithAllowanceFeeGate(ctx: GalaChainContext, dto: MintTokenWithAllowanceDto) {
  return galaFeeGate(ctx, {
    feeCode: FeeGateCodes.MintTokenWithAllowance
    // v1 fees requires only callingUser identities pay fees
    // uncomment below to require benefiting / initiating user to pay,
    // regardless of who executes the method
    // activeUser: dto.owner ?? ctx.callingUser
  });
}

export async function requestTokenBridgeOutFeeGate(ctx: GalaChainContext, dto: RequestTokenBridgeOutDto) {
  const { destinationChainId } = dto;

  // Dynamic, gas based fees are intended for bridging outside of GalaChain
  // In the future this list could include Solana, or other external Chains
  if (destinationChainId !== ChainId.Ethereum) {
    return;
  }

  const oracleKey = ChainObject.getCompositeKeyFromParts(OracleDefinition.INDEX_KEY, [KnownOracles.Bridge]);

  const oracleDefinitionLookup: OracleDefinition | ChainError = await getObjectByKey(
    ctx,
    OracleDefinition,
    oracleKey
  ).catch((e) => e);

  if (oracleDefinitionLookup instanceof ChainError && oracleDefinitionLookup.code === ErrorCode.NOT_FOUND) {
    // if the oracle is not defined, we don't charge a dynamic, gas based fee
    return galaFeeGate(ctx, { feeCode: FeeGateCodes.BridgeTokenOut });
  }

  const oracleDefinition: OracleDefinition = oracleDefinitionLookup as OracleDefinition;

  const oracleAssertion: OracleBridgeFeeAssertionDto | undefined = dto.destinationChainTxFee;

  if (oracleAssertion === undefined) {
    throw new ValidationFailedError(
      `Bridge Token Out Fee Gate requires a valid Oracle Assertion providing the ` +
        `estimated transaction fee for the destination chain. Provide a signed ` +
        `OracleBridgeFeeAssertionDto in the destinationChainTxFee property. `
    );
  }

  await oracleAssertion.validateOrReject().catch((e) => {
    throw new PaymentRequiredError(
      `Bridge Token Out Fee Gate requires a valid Oracle Assertion providing the ` +
        `estimated transaction fee for the destination chain. Provided ` +
        `oracleAssertion DTO validation failed: ${e.message}`,
      { paymentQuantity: oracleAssertion.estimatedTotalTxFeeInGala?.toString() }
    );
  });

  const identity = await authorize(ctx, oracleAssertion, oracleAssertion.signingIdentity);

  if (
    !oracleDefinition.authorities.includes(identity.alias) &&
    !oracleDefinition.authorities.includes(identity.ethAddress ?? "") &&
    !oracleDefinition.authorities.includes(oracleAssertion.signingIdentity)
  ) {
    throw new PaymentRequiredError(
      `BridgeTokenOut to destination chain ${destinationChainId} requires ` +
        `an Oracle to calculate an appropriate transaction fee. ` +
        `Received an assertion dto  with alias: ${identity.alias}, ` +
        `ethAddress?: ${identity.ethAddress}, and ` +
        `assertion signingIdentity: ${oracleAssertion.signingIdentity}. ` +
        `None of which are listed in the authorities definition: ` +
        `${oracleDefinition.authorities.join(", ")}`,
      { paymentQuantity: oracleAssertion.estimatedTotalTxFeeInGala.toString() }
    );
  }

  const gasFeeQuantity: BigNumber = oracleAssertion.estimatedTotalTxFeeInGala;

  // additional, GalaChain usage based fees optionally defined with FeeCodeDefinition(s)
  const { feeAmount, feeCodeDefinitions } = await writeUsageAndCalculateFeeAmount(ctx, {
    feeCode: FeeGateCodes.BridgeTokenOut
  });

  const combinedFeeTotal = gasFeeQuantity.plus(feeAmount);

  if (combinedFeeTotal.isGreaterThan(0)) {
    const isCrossChannelFee = feeCodeDefinitions[0]?.isCrossChannel ?? false;

    if (isCrossChannelFee) {
      await payFeeFromCrossChannelAuthorization(ctx, {
        quantity: combinedFeeTotal,
        feeCode: FeeGateCodes.BridgeTokenOut
      });
    } else {
      await payFeeImmediatelyFromBalance(ctx, {
        quantity: combinedFeeTotal,
        feeCode: FeeGateCodes.BridgeTokenOut
      });
    }
  }

  const {
    galaExchangeRate,
    galaDecimals,
    estimatedTxFeeUnitsTotal,
    estimatedPricePerTxFeeUnit,
    estimatedTotalTxFeeInExternalToken,
    estimatedTotalTxFeeInGala,
    timestamp,
    signingIdentity
  } = oracleAssertion;

  const txid = ctx.stub.getTxID();

  const bridgeFeeAssertionRecord = plainToInstance(OracleBridgeFeeAssertion, {
    oracle: KnownOracles.Bridge,
    signingIdentity,
    txid,
    galaDecimals,
    estimatedTxFeeUnitsTotal,
    estimatedPricePerTxFeeUnit,
    estimatedTotalTxFeeInExternalToken,
    estimatedTotalTxFeeInGala,
    timestamp
  });

  bridgeFeeAssertionRecord.galaExchangeRate = plainToInstance(OraclePriceAssertion, {
    ...galaExchangeRate,
    txid
  });

  await bridgeFeeAssertionRecord.galaExchangeRate.validateOrReject();
  await bridgeFeeAssertionRecord.validateOrReject();

  await putChainObject(ctx, bridgeFeeAssertionRecord);
}

export async function transferTokenFeeGate(ctx: GalaChainContext, dto: TransferTokenDto) {
  return galaFeeGate(ctx, {
    feeCode: FeeGateCodes.TransferToken
    // v1 fees requires only callingUser identities pay fees
    // uncomment below to require benefiting / initiating user to pay,
    // regardless of who executes the method
    // activeUser: dto.from ?? ctx.callingUser
  });
}

export async function galaSwapRequestFeeGate(ctx: GalaChainContext, dto: ChainCallDTO) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.SwapTokenRequest });
}

export async function galaSwapFillFeeGate(ctx: GalaChainContext, dto: FillTokenSwapDto) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.SwapTokenFill });
}

export async function galaSwapBatchFillFeeGate(ctx: GalaChainContext, dto: BatchFillTokenSwapDto) {
  for (let i = 0; i < dto.swapDtos.length; i++) {
    await galaFeeGate(ctx, { feeCode: FeeGateCodes.SwapTokenFill });
  }
}

export async function simpleFeeGate(ctx: GalaChainContext, dto: ChainCallDTO) {
  // example quick implementation fee gate
  // no need to write FeeCodeDefinitions or lookup FeeCodeDefinition objects to calc amount
  // tradeoff is its not flexible to update or modify, and won't record usage
  const hardcodedPromotionalFee = new BigNumber("1");

  await payFeeImmediatelyFromBalance(ctx, {
    feeCode: FeeGateCodes.SimpleFee,
    quantity: hardcodedPromotionalFee
  });
}
