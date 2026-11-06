import test from "node:test";
import assert from "node:assert/strict";
import {
    canApprovePayout,
    canExecutePayout,
    derivePayoutStatus,
} from "./payoutLifecycleService.js";

const proposed = { id: "12", approvals: [], executed: false };

test("a new payout proposal remains proposed before approvals", () => {
    assert.equal(derivePayoutStatus(proposed, 2), "proposed");
    assert.equal(canApprovePayout(proposed, 2), true);
    assert.equal(canExecutePayout(proposed, 2), false);
});

test("a proposal with some but not all approvals is partially approved", () => {
    const record = { ...proposed, approvals: ["0x0000000000000001"] };
    assert.equal(derivePayoutStatus(record, 2), "partially_approved");
    assert.equal(canApprovePayout(record, 2), true);
    assert.equal(canExecutePayout(record, 2), false);
});

test("a proposal becomes executable only after its approval threshold", () => {
    const record = { ...proposed, approvals: ["0x1", "0x2"] };
    assert.equal(derivePayoutStatus(record, 2), "approved");
    assert.equal(canApprovePayout(record, 2), false);
    assert.equal(canExecutePayout(record, 2), true);
});

test("an executed proposal cannot be approved or executed again", () => {
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
