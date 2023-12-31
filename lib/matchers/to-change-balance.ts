import { Field, Mina, PublicKey, Sign, UInt64 } from "o1js";
import { expect } from "@jest/globals";
import { FieldLike } from "../types";
import { matchesField } from "../utils";

const stringifySignedField = (amount: FieldLike, sign: Sign) => `${sign.isPositive().toBoolean() ? "" : "-"}${amount.toString()}`;

type SignedUInt64 = {
  magnitude: UInt64,
  sgn: Sign
}

const signsAreEqual = (s1: Sign, s2: Sign) =>
  s1.isPositive().equals(s2.isPositive()).toBoolean();
const sumSignedField = (s1: SignedUInt64, s2: SignedUInt64): SignedUInt64 => {
  if (signsAreEqual(s1.sgn, s2.sgn))
    return {
      magnitude: s1.magnitude.add(s2.magnitude),
      sgn: s1.sgn
    };
  if (s1.magnitude.greaterThan(s2.magnitude).toBoolean())
    return {
      magnitude: s1.magnitude.sub(s2.magnitude),
      sgn: s1.sgn
    };
  return {
    magnitude: s2.magnitude.sub(s1.magnitude),
    sgn: s2.sgn
  };
}
const toChangeBalance = (transaction: Mina.Transaction, publicKey: PublicKey, tokenIdParam: FieldLike, amount: FieldLike, sign: Sign) => {
  const tokenId = Field.from(tokenIdParam)
  const accountUpdates = transaction.transaction.accountUpdates.filter(update => update.body.publicKey.equals(publicKey).toBoolean() && update.body.tokenId.equals(tokenId).toBoolean())

  const base = `Expected ${publicKey.toBase58()}'s balance for token ${tokenId.toString()} by ${stringifySignedField(amount, sign)}`
  if (accountUpdates.length === 0 && !matchesField(0, amount)) {
    return {
      pass: false,
      message: () => `${base} but it didn't change`
    };
  }
  const sumChanges: SignedUInt64 = accountUpdates.map(a => a.body.balanceChange).reduce(sumSignedField, {
    magnitude: UInt64.from(0),
    sgn: Sign.one
  });

  const pass = matchesField(amount, sumChanges.magnitude.value) &&
                (matchesField(amount, 0) || // if amount is 0, sign does not matter
                  signsAreEqual(sign, sumChanges.sgn));

  return {
    pass,
    message: () => `${base} but it changed by ${stringifySignedField(sumChanges.magnitude.value, sumChanges.sgn)}`
  };
};


/**
 * Defines Jest matchers for common types.
 */
export default () => {
  expect.extend({
    /**
     * Checks if the account received tokens in the transaction
     * @param {Transaction} transaction - Transaction expected to change balance
     * @param {PublicKey} account - Account expected to change
     * @param {FieldLike} tokenId - Token Id expected to change(usually 1)
     * @param {FieldLike} amount - Amount expected to increase
     * @returns {MatcherResult} - The result of the matcher.
     */
    toIncreaseBalance(transaction: Mina.Transaction, account: PublicKey, tokenId: FieldLike, amount: FieldLike) {
      return toChangeBalance(transaction, account, tokenId, amount, Sign.one);
    },
    /**
     * Checks if the account had the same tokens after the transaction
     * @param {Transaction} transaction - Transaction expected to keep balance unchanged
     * @param {PublicKey} account - Account expected to keep balance unchanged
     * @param {FieldLike} tokenId - Token Id expected to keep balance unchanged(usually 1)
     * @returns {MatcherResult} - The result of the matcher.
     */
    toKeepBalanceUnchanged(transaction: Mina.Transaction, account: PublicKey, tokenId: FieldLike) {
      return toChangeBalance(transaction, account, tokenId, 0, Sign.one);
    },
    /**
     * Checks if the account sent tokens in the transaction
     * @param {Transaction} transaction - Transaction expected to change balance
     * @param {PublicKey} account - Account expected to change
     * @param {FieldLike} tokenId - Token Id expected to change(usually 1)
     * @param {FieldLike} amount - Amount expected to increase
     * @returns {MatcherResult} - The result of the matcher.
     */
    toDecreaseBalance(transaction: Mina.Transaction, account: PublicKey, tokenId: FieldLike, amount: FieldLike) {
      return toChangeBalance(transaction, account, tokenId, amount, Sign.minusOne);
    },
    /**
     * Checks if the account sent/redeceived tokens in the transaction
     * @param {Transaction} transaction - Transaction expected to change balance
     * @param {PublicKey} account - Account expected to change
     * @param {FieldLike} tokenId - Token Id expected to change(usually 1)
     * @param {FieldLike} amount - Amount expected to change
     * @param {Sign} sign - One if expected to increase, minus one if expected to decrease
     * @returns {MatcherResult} - The result of the matcher.
     */
    toChangeBalance
  });
};
