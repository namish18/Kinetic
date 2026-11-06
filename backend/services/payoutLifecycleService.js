function approvalCount(record) {
    return Array.isArray(record?.approvals) ? record.approvals.length : 0;
}

export function derivePayoutStatus(record, requiredApprovals) {
    if (!record) throw new TypeError("A payout record is required");
    if (!Number.isSafeInteger(requiredApprovals) || requiredApprovals < 1) {
        throw new RangeError("Required approvals must be a positive integer");
    }
    if (record.executed) return "executed";
    if (approvalCount(record) >= requiredApprovals) return "approved";
    if (approvalCount(record) > 0) return "partially_approved";
    return "proposed";
}

export function canApprovePayout(record, requiredApprovals) {
    return Boolean(record && !record.executed &&
        Number.isSafeInteger(requiredApprovals) && requiredApprovals >= 1 &&
        approvalCount(record) < requiredApprovals);
}

export function canExecutePayout(record, requiredApprovals) {
    return Boolean(record && !record.executed &&
        Number.isSafeInteger(requiredApprovals) && requiredApprovals >= 1 &&
        approvalCount(record) >= requiredApprovals);
}
