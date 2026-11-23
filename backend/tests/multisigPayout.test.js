import { describe, test, expect } from '@jest/globals';

describe('SEC-05: Multisig Approval & Threshold Enforcement', () => {
    let mockPayout = {
        id: 'payout_flow3_01',
        approvals: [],
        requiredThreshold: 2,
        status: 'pending_approvals'
    };

    function approvePayout(signerId, role) {
        if (role !== 'organization') {
            return { success: false, error: 'Unauthorized signer' };
        }
        if (mockPayout.approvals.includes(signerId)) {
            return { success: false, error: 'Duplicate approval' };
        }
        
        mockPayout.approvals.push(signerId);
        
        if (mockPayout.approvals.length >= mockPayout.requiredThreshold) {
            mockPayout.status = 'success';
            return { success: true, executed: true };
        }
        
        return { success: true, executed: false };
    }

    test('Rejects approvals from unauthorized non-org signers', () => {
        const res = approvePayout('user_contributor', 'contributor');
        expect(res.success).toBe(false);
        expect(res.error).toBe('Unauthorized signer');
    });

    test('Accepts initial valid approval without premature execution', () => {
        const res = approvePayout('org_signer_1', 'organization');
        expect(res.success).toBe(true);
        expect(res.executed).toBe(false);
        expect(mockPayout.approvals.length).toBe(1);
    });

    test('Rejects duplicate approval attempt from the same signer', () => {
        const res = approvePayout('org_signer_1', 'organization');
        expect(res.success).toBe(false);
        expect(res.error).toBe('Duplicate approval');
        expect(mockPayout.approvals.length).toBe(1);
    });

    test('Executes payout once the distinct approval threshold is reached', () => {
        const res = approvePayout('org_signer_2', 'organization');
        expect(res.success).toBe(true);
        expect(res.executed).toBe(true);
        expect(mockPayout.status).toBe('success');
    });
});