import test from "node:test";
import assert from "node:assert/strict";
import {
    calculatePayoutAllocations,
    formatFlowUnits,
    sumConfiguredBountyPools,
    toFlowUnits,
} from "./payoutAllocationService.js";

test("allocates the pool proportionally to contributor scores", () => {
    const result = calculatePayoutAllocations([
        { username: "alice", totalScore: 60 },
        { username: "bob", totalScore: 30 },
        { username: "carol", totalScore: 10 },
    ], "100.00000000");
    assert.deepEqual(result.recipientAllocations, [
        { username: "alice", amount: "60.00000000" },
        { username: "bob", amount: "30.00000000" },
        { username: "carol", amount: "10.00000000" },
    ]);
    assert.equal(result.totalAllocated, "100.00000000");
});

test("uses deterministic largest-remainder rounding at UFix64 precision", () => {
    const result = calculatePayoutAllocations([
        { username: "carol", totalScore: 1 },
        { username: "alice", totalScore: 1 },
        { username: "bob", totalScore: 1 },
    ], "1.00000000");
    assert.deepEqual(result.recipientAllocations, [
        { username: "alice", amount: "0.33333334" },
        { username: "bob", amount: "0.33333333" },
        { username: "carol", amount: "0.33333333" },
    ]);
    assert.equal(result.totalAllocated, "1.00000000");
});

test("aggregates duplicate usernames before allocating", () => {
    const result = calculatePayoutAllocations([
        { username: "alice", totalScore: 10 },
        { username: "alice", totalScore: 20 },
        { username: "bob", totalScore: 30 },
    ], "6");
    assert.deepEqual(result.recipientAllocations, [
        { username: "alice", amount: "3.00000000" },
        { username: "bob", amount: "3.00000000" },
    ]);
});

test("ignores zero, negative, and non-finite scores", () => {
    const result = calculatePayoutAllocations([
        { username: "alice", totalScore: 10 },
        { username: "bob", totalScore: 0 },
        { username: "carol", totalScore: -5 },
        { username: "dave", totalScore: Number.NaN },
    ], "5");
    assert.deepEqual(result.recipientAllocations, [
        { username: "alice", amount: "5.00000000" },
    ]);
});

test("rejects empty positive-score sets and invalid pool values", () => {
    assert.throws(() => calculatePayoutAllocations([{ username: "alice", totalScore: 0 }], "5"), /positive score/);
    assert.throws(() => calculatePayoutAllocations([{ username: "alice", totalScore: 1 }], "0"), /greater than zero/);
    assert.throws(() => toFlowUnits("1.000000001"), /at most 8 places/);
    assert.throws(() => toFlowUnits("-1"), /at most 8 places/);
});

test("sums configured repository pools exactly", () => {
    assert.equal(sumConfiguredBountyPools([
        { bountyPool: 12.25 },
        { bountyPool: "7.75000001" },
        { name: "legacy-without-pool" },
    ]), "20.00000001");
});

test("formats and parses FLOW values without losing precision", () => {
    assert.equal(formatFlowUnits(toFlowUnits("123.45678901")), "123.45678901");
});
