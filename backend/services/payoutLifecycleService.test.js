import test from "node:test";
import assert from "node:assert/strict";
import {
    canApprovePayout,
    canExecutePayout,
    derivePayoutStatus,
} from "./payoutLifecycleService.js";

const proposed = { id: "12", approvals: [], executed: false };

test("new proposals remain proposed before approvals", () => {
    assert.equal(derivePayoutStatus(proposed, 2), "proposed");
    assert.equal(canApprovePayout(proposed, 2), true);
    assert.equal(canExecutePayout(proposed, 2), false);
});

test("partial approval does not permit execution", () => {
    const record = { ...proposed, approvals: ["0x1"] };
    assert.equal(derivePayoutStatus(record, 2), "partially_approved");
    assert.equal(canApprovePayout(record, 2), true);
    assert.equal(canExecutePayout(record, 2), false);
});

test("the approval threshold makes a proposal executable", () => {
    const record = { ...proposed, approvals: ["0x1", "0x2"] };
    assert.equal(derivePayoutStatus(record, 2), "approved");
    assert.equal(canApprovePayout(record, 2), false);
    assert.equal(canExecutePayout(record, 2), true);
});

test("executed payouts cannot be approved or executed again", () => {
    const record = { ...proposed, approvals: ["0x1", "0x2"], executed: true };
    assert.equal(derivePayoutStatus(record, 2), "executed");
    assert.equal(canApprovePayout(record, 2), false);
    assert.equal(canExecutePayout(record, 2), false);
});

test("invalid thresholds and missing records are rejected safely", () => {
    assert.throws(() => derivePayoutStatus(null, 1), /record is required/);
    assert.throws(() => derivePayoutStatus(proposed, 0), /positive integer/);
    assert.equal(canApprovePayout(null, 1), false);
    assert.equal(canExecutePayout(proposed, 0), false);
});
