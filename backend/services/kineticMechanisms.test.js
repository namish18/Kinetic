
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSpamPenalty } from './kineticMechanisms.js';

test('MSTS Spam Penalty & Velocity Engine', async (t) => {
    await t.test('returns 1.0 for first submission', () => {
        const penalty = calculateSpamPenalty([
            '2026-11-03T10:00:00Z'
        ]);

        assert.equal(penalty, 1.0);
    });

    await t.test('applies extra penalty for rapid succession (<10 mins)', () => {
        const timestamps = [
            '2026-11-03T10:00:00Z',
            '2026-11-03T10:04:00Z'
        ];

        const penalty = calculateSpamPenalty(timestamps);

        assert.ok(
            penalty < 0.8,
            `Expected penalty below 0.8, received ${penalty}`
        );
    });
});
