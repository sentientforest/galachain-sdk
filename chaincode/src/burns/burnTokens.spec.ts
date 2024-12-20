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
  BurnTokensDto,
  GalaChainResponse,
  TokenAllowance,
  TokenBalance,
  TokenBurn,
  TokenBurnCounter,
  TokenClaim,
  createValidChainObject,
  createValidSubmitDTO
} from "@gala-chain/api";
import { currency, fixture, nft, users, writesMap } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { instanceToInstance, plainToInstance } from "class-transformer";

import GalaChainTokenContract from "../__test__/GalaChainTokenContract";
import { InvalidDecimalError } from "../token";
import { inverseEpoch, inverseTime } from "../utils";
import { InsufficientBurnAllowanceError } from "./BurnError";
import { burnTokens } from "./burnTokens";

describe("BurnTokens", () => {
  it("should BurnTokens", async () => {
    // Given
    const nftInstance = nft.tokenInstance1();
    const nftInstanceKey = nft.tokenInstance1Key();
    const nftClass = nft.tokenClass();
    const tokenBalance = nft.tokenBalance();

    const { ctx, contract, getWrites } = fixture(GalaChainTokenContract)
      .registeredUsers(users.testUser1)
      .savedState(nftClass, nftInstance, tokenBalance)
      .savedRangeState([]);

    const dto = await createValidSubmitDTO(BurnTokensDto, {
      tokenInstances: [{ tokenInstanceKey: nftInstanceKey, quantity: new BigNumber("1") }]
    }).signed(users.testUser1.privateKey);

    const totalKnownBurns = new BigNumber("0");
    const nftTokenBurn = await createValidChainObject(TokenBurn, nft.tokenBurnPlain(ctx.txUnixTime));

    const nftTokenBurnCounterPlain = nft.tokenBurnCounterPlain(
      ctx.txUnixTime,
      inverseTime(ctx, 0),
      inverseEpoch(ctx, 0),
      totalKnownBurns
    );
    const nftTokenBurnCounter = plainToInstance(TokenBurnCounter, nftTokenBurnCounterPlain);
    nftTokenBurnCounter.referenceId = nftTokenBurnCounter.referencedBurnId();

    // When
    const response = await contract.BurnTokens(ctx, dto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success([nftTokenBurn]));
    expect(getWrites()).toEqual(
      writesMap(
        plainToInstance(TokenBalance, { ...tokenBalance, quantity: new BigNumber(0), instanceIds: [] }),
        nftTokenBurn,
        nftTokenBurnCounter
      )
    );
  });

  it("should fail to BurnTokens with quantity lower than decimal limit (10)", async () => {
    // Given
    const currencyInstance = currency.tokenInstance();
    const currencyInstanceKey = currency.tokenInstanceKey();
    const currencyClass = currency.tokenClass();
    const tokenBalance = currency.tokenBalance();

    const { ctx, contract, getWrites } = fixture(GalaChainTokenContract)
      .registeredUsers(users.testUser1)
      .savedState(currencyClass, currencyInstance, tokenBalance)
      .savedRangeState([]);

    const decimalQuantity = new BigNumber("0.00000000001");
    const dto = await createValidSubmitDTO(BurnTokensDto, {
      tokenInstances: [{ tokenInstanceKey: currencyInstanceKey, quantity: decimalQuantity }]
    }).signed(users.testUser1.privateKey);

    // When
    const response = await contract.BurnTokens(ctx, dto);

    // Then
    expect(response).toEqual(
      GalaChainResponse.Error(new InvalidDecimalError(decimalQuantity, currencyClass.decimals))
    );
    expect(getWrites()).toEqual({});
  });

  test("burns currency with burn allowance", async () => {
    // Given
    const currencyInstance = currency.tokenInstance();
    const currencyInstanceKey = currency.tokenInstanceKey();
    const currencyClass = currency.tokenClass();
    const tokenBalance = currency.tokenBalance();
    const burnQty = new BigNumber("1");
    const tokenBurnAllowance = currency.tokenBurnAllowance();

    const { ctx, contract, getWrites } = fixture(GalaChainTokenContract)
      .registeredUsers(users.testUser2)
      .savedState(currencyClass, currencyInstance, tokenBurnAllowance, tokenBalance)
      .savedRangeState([]);

    const dto = await createValidSubmitDTO(BurnTokensDto, {
      tokenInstances: [{ tokenInstanceKey: currencyInstanceKey, quantity: burnQty }],
      owner: users.testUser1.identityKey
    }).signed(users.testUser2.privateKey);

    const tokenBurn = currency.tokenBurn();
    tokenBurn.created = ctx.txUnixTime;
    const tokenBurnCounter = plainToInstance(
      TokenBurnCounter,
      currency.tokenBurnCounterPlain(
        ctx.txUnixTime,
        inverseTime(ctx, 0),
        inverseEpoch(ctx, 0),
        new BigNumber("0")
      )
    );
    tokenBurnCounter.referenceId = tokenBurnCounter.referencedBurnId();

    const tokenClaim = await createValidChainObject(TokenClaim, {
      ...currencyInstanceKey,
      ownerKey: users.testUser2.identityKey,
      issuerKey: users.testUser1.identityKey,
      instance: new BigNumber("0"),
      action: 6,
      quantity: burnQty,
      allowanceCreated: 1,
      claimSequence: new BigNumber("1"),
      created: ctx.txUnixTime
    });

    const expectedAllowance = await createValidChainObject(TokenAllowance, {
      ...tokenBurnAllowance,
      usesSpent: new BigNumber("1"),
      quantitySpent: burnQty,
      expires: ctx.txUnixTime
    });

    // When
    const response = await contract.BurnTokens(ctx, dto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success([tokenBurn]));
    expect(getWrites()).toEqual(
      writesMap(
        tokenClaim,
        expectedAllowance,
        plainToInstance(TokenBalance, {
          ...currency.tokenBalance(),
          quantity: new BigNumber("999")
        }),
        tokenBurn,
        tokenBurnCounter
      )
    );
  });

  test("burns currency with infinite burn allowance", async () => {
    // Given
    const currencyInstance = currency.tokenInstance();
    const currencyInstanceKey = currency.tokenInstanceKey();
    const currencyClass = currency.tokenClass();
    const tokenBalance = currency.tokenBalance();
    const burnQty = new BigNumber("1");
    const tokenBurnAllowance = currency.tokenBurnAllowance();
    tokenBurnAllowance.quantity = new BigNumber(Infinity);
    delete tokenBurnAllowance.usesSpent;
    delete tokenBurnAllowance.quantitySpent;

    const { ctx, contract, getWrites } = fixture(GalaChainTokenContract)
      .registeredUsers(users.testUser2)
      .savedState(currencyClass, currencyInstance, tokenBurnAllowance, tokenBalance)
      .savedRangeState([]);

    const dto = await createValidSubmitDTO(BurnTokensDto, {
      tokenInstances: [{ tokenInstanceKey: currencyInstanceKey, quantity: burnQty }],
      owner: users.testUser1.identityKey
    }).signed(users.testUser2.privateKey);

    const tokenBurn = currency.tokenBurn();
    tokenBurn.created = ctx.txUnixTime;
    const tokenBurnCounter = plainToInstance(
      TokenBurnCounter,
      currency.tokenBurnCounterPlain(
        ctx.txUnixTime,
        inverseTime(ctx, 0),
        inverseEpoch(ctx, 0),
        new BigNumber("0")
      )
    );
    tokenBurnCounter.referenceId = tokenBurnCounter.referencedBurnId();

    // When
    const response = await contract.BurnTokens(ctx, dto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success([tokenBurn]));
    expect(getWrites()).toEqual(
      writesMap(
        plainToInstance(TokenBalance, { ...currency.tokenBalance(), quantity: new BigNumber("999") }),
        tokenBurn,
        tokenBurnCounter
      )
    );
  });

  test("burns currency with multiple allowances", async () => {
    // Given
    const currencyInstance = currency.tokenInstance();
    const currencyInstanceKey = currency.tokenInstanceKey();
    const currencyClass = currency.tokenClass();
    const tokenBalance = currency.tokenBalance();
    const burnQty = new BigNumber("1");
    const tokenMintAllowance = currency.tokenMintAllowance();
    const tokenBurnAllowance = currency.tokenBurnAllowance();

    const { ctx, contract, getWrites } = fixture(GalaChainTokenContract)
      .registeredUsers(users.testUser2)
      .savedState(currencyClass, currencyInstance, tokenMintAllowance, tokenBurnAllowance, tokenBalance)
      .savedRangeState([]);

    const dto = await createValidSubmitDTO(BurnTokensDto, {
      tokenInstances: [{ tokenInstanceKey: currencyInstanceKey, quantity: burnQty }],
      owner: users.testUser1.identityKey
    }).signed(users.testUser2.privateKey);

    const tokenBurn = currency.tokenBurn();
    tokenBurn.created = ctx.txUnixTime;
    const tokenBurnCounter = plainToInstance(
      TokenBurnCounter,
      currency.tokenBurnCounterPlain(
        ctx.txUnixTime,
        inverseTime(ctx, 0),
        inverseEpoch(ctx, 0),
        new BigNumber("0")
      )
    );
    tokenBurnCounter.referenceId = tokenBurnCounter.referencedBurnId();

    const tokenClaim = await createValidChainObject(TokenClaim, {
      ...currencyInstanceKey,
      ownerKey: users.testUser2.identityKey,
      issuerKey: users.testUser1.identityKey,
      instance: new BigNumber("0"),
      action: 6,
      quantity: burnQty,
      allowanceCreated: 1,
      claimSequence: new BigNumber("1"),
      created: ctx.txUnixTime
    });

    const expectedAllowance = await createValidChainObject(TokenAllowance, {
      ...tokenBurnAllowance,
      usesSpent: new BigNumber("1"),
      quantitySpent: burnQty,
      expires: ctx.txUnixTime
    });

    // When
    const response = await contract.BurnTokens(ctx, dto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success([tokenBurn]));
    expect(getWrites()).toEqual(
      writesMap(
        tokenClaim,
        expectedAllowance,
        plainToInstance(TokenBalance, { ...currency.tokenBalance(), quantity: new BigNumber("999") }),
        tokenBurn,
        tokenBurnCounter
      )
    );
  });

  test("should filter allowances by owner (grantedBy)", async () => {
    // Given
    const currencyInstance = currency.tokenInstance();
    const currencyInstanceKey = currency.tokenInstanceKey();
    const currencyClass = currency.tokenClass();
    const tokenBalance = currency.tokenBalance();
    const burnQty = new BigNumber("1");
    const tokenBurnAllowanceUser3 = currency.tokenBurnAllowanceUser3();
    const tokenBurnAllowance = currency.tokenBurnAllowance();

    const { ctx, contract, getWrites } = fixture(GalaChainTokenContract)
      .registeredUsers(users.testUser2)
      .savedState(currencyClass, currencyInstance, tokenBurnAllowanceUser3, tokenBurnAllowance, tokenBalance)
      .savedRangeState([]);

    const dto = await createValidSubmitDTO(BurnTokensDto, {
      tokenInstances: [{ tokenInstanceKey: currencyInstanceKey, quantity: burnQty }],
      owner: users.testUser1.identityKey
    }).signed(users.testUser2.privateKey);

    const tokenBurn = currency.tokenBurn();
    tokenBurn.created = ctx.txUnixTime;
    const tokenBurnCounter = plainToInstance(
      TokenBurnCounter,
      currency.tokenBurnCounterPlain(
        ctx.txUnixTime,
        inverseTime(ctx, 0),
        inverseEpoch(ctx, 0),
        new BigNumber("0")
      )
    );
    tokenBurnCounter.referenceId = tokenBurnCounter.referencedBurnId();

    const tokenClaim = await createValidChainObject(TokenClaim, {
      ...currencyInstanceKey,
      ownerKey: users.testUser2.identityKey,
      issuerKey: users.testUser1.identityKey,
      instance: new BigNumber("0"),
      action: 6,
      quantity: burnQty,
      allowanceCreated: 1,
      claimSequence: new BigNumber("1"),
      created: ctx.txUnixTime
    });

    const expectedAllowance = await createValidChainObject(TokenAllowance, {
      ...tokenBurnAllowance,
      usesSpent: new BigNumber("1"),
      quantitySpent: burnQty,
      expires: ctx.txUnixTime
    });

    // When
    const response = await contract.BurnTokens(ctx, dto);

    // Then
    expect(response).toEqual(GalaChainResponse.Success([tokenBurn]));
    expect(getWrites()).toEqual(
      writesMap(
        tokenClaim,
        expectedAllowance,
        plainToInstance(TokenBalance, { ...currency.tokenBalance(), quantity: new BigNumber("999") }),
        tokenBurn,
        tokenBurnCounter
      )
    );
  });

  test("should fail to burn currency with wrong allowance", async () => {
    // Given
    const currencyInstance = currency.tokenInstance();
    const currencyInstanceKey = currency.tokenInstanceKey();
    const currencyClass = currency.tokenClass();
    const tokenBalance = currency.tokenBalance();
    const burnQty = new BigNumber("1");
    const tokenMintAllowance = currency.tokenMintAllowance();

    const { ctx, contract, getWrites } = fixture(GalaChainTokenContract)
      .registeredUsers(users.testUser2)
      .savedState(currencyClass, currencyInstance, tokenMintAllowance, tokenBalance)
      .savedRangeState([]);

    const dto = await createValidSubmitDTO(BurnTokensDto, {
      tokenInstances: [{ tokenInstanceKey: currencyInstanceKey, quantity: burnQty }],
      owner: users.testUser1.identityKey
    }).signed(users.testUser2.privateKey);

    const tokenBurn = currency.tokenBurn();
    tokenBurn.created = ctx.txUnixTime;
    const tokenBurnCounter = plainToInstance(
      TokenBurnCounter,
      currency.tokenBurnCounterPlain(
        ctx.txUnixTime,
        inverseTime(ctx, 0),
        inverseEpoch(ctx, 0),
        new BigNumber("0")
      )
    );
    tokenBurnCounter.referenceId = tokenBurnCounter.referencedBurnId();

    // When
    const response = await contract.BurnTokens(ctx, dto);

    // Then
    expect(response).toEqual(
      GalaChainResponse.Error(
        new InsufficientBurnAllowanceError(
          users.testUser2.identityKey,
          new BigNumber("0"),
          burnQty,
          currencyInstanceKey,
          users.testUser1.identityKey
        )
      )
    );
    expect(getWrites()).toEqual({});
  });

  test("fails to burn currency with no allowance", async () => {
    // Given
    const currencyInstance = currency.tokenInstance();
    const currencyInstanceKey = currency.tokenInstanceKey();
    const currencyClass = currency.tokenClass();
    const tokenBalance = currency.tokenBalance();
    const burnQty = new BigNumber("1");

    const { ctx, contract, getWrites } = fixture(GalaChainTokenContract)
      .registeredUsers(users.testUser2)
      .savedState(currencyClass, currencyInstance, tokenBalance)
      .savedRangeState([]);

    const dto = await createValidSubmitDTO(BurnTokensDto, {
      tokenInstances: [{ tokenInstanceKey: currencyInstanceKey, quantity: burnQty }],
      owner: users.testUser1.identityKey
    }).signed(users.testUser2.privateKey);

    // When
    const response = await contract.BurnTokens(ctx, dto);

    // Then
    expect(response).toEqual(
      GalaChainResponse.Error(
        new InsufficientBurnAllowanceError(
          users.testUser2.identityKey,
          new BigNumber("0"),
          burnQty,
          currencyInstanceKey,
          users.testUser1.identityKey
        )
      )
    );
    expect(getWrites()).toEqual({});
  });

  it(
    "should increment the total when multiple quantities " +
      "with identical parameters are passed to burnTokens()",
    async () => {
      // Given
      const currencyInstance = currency.tokenInstance();
      const currencyInstanceKey = currency.tokenInstanceKey();
      const currencyClass = currency.tokenClass();
      const tokenBalance = currency.tokenBalance();
      const burnQty = new BigNumber("1");
      const burn2Qty = new BigNumber("2");

      const { ctx, contract, getWrites } = fixture(GalaChainTokenContract)
        .registeredUsers(users.testUser1)
        .savedState(currencyClass, currencyInstance, tokenBalance)
        .savedRangeState([]);

      const dto = await createValidSubmitDTO(BurnTokensDto, {
        tokenInstances: [
          { tokenInstanceKey: currencyInstanceKey, quantity: burnQty },
          { tokenInstanceKey: currencyInstanceKey, quantity: burn2Qty }
        ],
        owner: users.testUser1.identityKey
      }).signed(users.testUser1.privateKey);

      const tokenBurn = currency.tokenBurn();
      tokenBurn.created = ctx.txUnixTime;
      tokenBurn.quantity = burnQty.plus(burn2Qty);

      const tokenBurnCounter = plainToInstance(
        TokenBurnCounter,
        currency.tokenBurnCounterPlain(
          ctx.txUnixTime,
          inverseTime(ctx, 0),
          inverseEpoch(ctx, 0),
          new BigNumber("0")
        )
      );
      tokenBurnCounter.referenceId = tokenBurnCounter.referencedBurnId();
      tokenBurnCounter.quantity = burnQty.plus(burn2Qty);

      // When
      const response = await contract.BurnTokens(ctx, dto);

      // Then
      expect(response).toEqual(GalaChainResponse.Success([tokenBurn]));
      expect(getWrites()).toEqual(
        writesMap(
          plainToInstance(TokenBalance, {
            ...currency.tokenBalance(),
            quantity: tokenBalance.getQuantityTotal().minus(burnQty).minus(burn2Qty)
          }),
          tokenBurn,
          tokenBurnCounter
        )
      );
    }
  );

  it(
    "should increment the total when burnTokens() is called multiple times with identical " +
      "token instance parameters within a single transaction",
    async () => {
      // Given
      const currencyInstance = currency.tokenInstance();
      const currencyInstanceKey = currency.tokenInstanceKey();
      const currencyClass = currency.tokenClass();
      const tokenBalance = currency.tokenBalance();
      const burnQty = new BigNumber("1");
      const burn2Qty = new BigNumber("2");

      const { ctx, getWrites } = fixture(GalaChainTokenContract)
        .callingUser(users.testUser1)
        .savedState(currencyClass, currencyInstance, tokenBalance)
        .savedRangeState([]);

      const call1 = {
        toBurn: [{ tokenInstanceKey: currencyInstanceKey, quantity: burnQty }],
        owner: users.testUser1.identityKey
      };

      const call2 = {
        toBurn: [{ tokenInstanceKey: currencyInstanceKey, quantity: burn2Qty }],
        owner: users.testUser1.identityKey
      };

      const tokenBurn = currency.tokenBurn();
      tokenBurn.created = ctx.txUnixTime;
      tokenBurn.quantity = burnQty;

      const tokenBurnWithSumTotal = instanceToInstance(tokenBurn);
      tokenBurnWithSumTotal.quantity = burnQty.plus(burn2Qty);

      const tokenBurnCounter = plainToInstance(
        TokenBurnCounter,
        currency.tokenBurnCounterPlain(
          ctx.txUnixTime,
          inverseTime(ctx, 0),
          inverseEpoch(ctx, 0),
          new BigNumber("0")
        )
      );
      tokenBurnCounter.referenceId = tokenBurnCounter.referencedBurnId();
      tokenBurnCounter.quantity = burnQty.plus(burn2Qty);

      // When
      const result1 = await burnTokens(ctx, call1);
      const result2 = await burnTokens(ctx, call2);

      await ctx.stub.flushWrites();

      // Then
      expect(result1).toEqual([tokenBurn]);
      expect(result2).toEqual([tokenBurnWithSumTotal]);
      expect(getWrites()).toEqual(
        writesMap(
          plainToInstance(TokenBalance, {
            ...currency.tokenBalance(),
            quantity: tokenBalance.getQuantityTotal().minus(burnQty).minus(burn2Qty)
          }),
          tokenBurnWithSumTotal,
          tokenBurnCounter
        )
      );
    }
  );
});
