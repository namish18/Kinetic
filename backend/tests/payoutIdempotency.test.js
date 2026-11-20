import { describe, test, expect } from '@jest/globals';

describe('Payout Idempotency per Contribution and Epoch', () => {
    const mockDb = new Map();

    function processPayout(contributionId, epochId, amount) {
        const key = `${contributionId}_${epochId}`;
        if (mockDb.has(key)) {
            return { status: 'already_processed', duplicate: true };
        }
        mockDb.set(key, { contributionId, epochId, amount, status: 'success' });
        return { status: 'success', duplicate: false };
    }

    test('First payout attempt executes successfully', () => {
        const res = processPayout('contrib_101', 'epoch_1', 50);
        expect(res.status).toBe('success');
        expect(res.duplicate).toBe(false);
    });

    test('Repeated payout attempt for same contribution and epoch returns already_processed state', () => {
        const res = processPayout('contrib_101', 'epoch_1', 50);
        expect(res.status).toBe('already_processed');
        expect(res.duplicate).toBe(true);
    });

    test('Same contribution in a different epoch processes independently', () => {
        const res = processPayout('contrib_101', 'epoch_2', 50);
        expect(res.status).toBe('success');
        expect(res.duplicate).toBe(false);
    });
});