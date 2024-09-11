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
import { ChainError, ErrorCode, FeeCodeDefinition, FetchFeeScheduleResDto, NotFoundError } from "@gala-chain/api";
import { GalaChainContext } from "../types";
import BigNumber from "bignumber.js";

import { getObjectsByPartialCompositeKeyWithPagination, takeUntilUndefined } from "../utils";

export interface FetchFeeScheduleParams {
  feeCode?: string;
  feeThresholdUses?: BigNumber;
  bookmark?: string;
  limit?: number;
}

// provide no feeCode to return the whole schedule
// provide a feeCode to return a specific feeCode progression
export async function fetchFeeSchedule(
  ctx: GalaChainContext,
  data: FetchFeeScheduleParams
): Promise<FetchFeeScheduleResDto> {
  const queryParams: Array<string> = takeUntilUndefined(data.feeCode, data.feeThresholdUses?.toString());

  const lookup = await getObjectsByPartialCompositeKeyWithPagination(
    ctx,
    FeeCodeDefinition.INDEX_KEY,
    queryParams,
    FeeCodeDefinition,
    data.bookmark,
    data.limit
  ).catch((e) => {
    throw ChainError.map(e, ErrorCode.NOT_FOUND, new NotFoundError(ctx.callingUser));
  });

  const response = new FetchFeeScheduleResDto();

  const results = lookup.results;
  if (data.feeCode === undefined) {
    sortFeeDefinitionsByCode(results);
  }
  response.results = results;
  response.nextPageBookmark = lookup.metadata.bookmark;

  return response;
}

export function compareFeeThresholds(a: FeeCodeDefinition, b: FeeCodeDefinition): number {
  return a.feeThresholdUses.isLessThan(b.feeThresholdUses) ? -1 : 1;
}

export async function sortFeeDefinitionsByThreshold(results: FeeCodeDefinition[]) {
  results.sort(compareFeeThresholds);
}

export async function sortFeeDefinitionsByCode(results: FeeCodeDefinition[]) {
  results.sort((a: FeeCodeDefinition, b: FeeCodeDefinition): number => {
    if (a.feeCode === b.feeCode) {
      return compareFeeThresholds(a, b);
    } else {
      return a.feeCode < b.feeCode ? -1 : 1;
    }
  });
}
