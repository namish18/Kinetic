import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import User from "../models/User.js";
import {
    approvePayout,
    executePayout,
    getPayout,
    getRequiredApprovals,
} from "../services/flowService.js";
import {
    canApprovePayout,
    canExecutePayout,
    derivePayoutStatus,
} from "../services/payoutLifecycleService.js";

const router = express.Router();

async function requireOrganization(req, res) {
    const organization = await User.findById(req.user.id);
    if (!organization) {
        res.status(404).json({ error: "Organization account not found" });
        return null;
    }
    if (organization.role !== "organization") {
        res.status(403).json({ error: "Only organization accounts can manage payout proposals" });
        return null;
    }
    return organization;
}

function isValidPayoutId(value) {
    const id = String(value);
    return /^\d+$/.test(id) && BigInt(id) > 0n;
}

function toResponse(record, requiredApprovals) {
    return {
        payoutId: record.id,
        status: derivePayoutStatus(record, requiredApprovals),
        totalAmount: record.totalAmount,
        amounts: record.amounts,
        approvals: record.approvals,
        approvalCount: record.approvals.length,
        requiredApprovals,
        executed: record.executed,
    };
}

router.get("/:payoutId", authenticateToken, async (req, res) => {
    try {
        if (!(await requireOrganization(req, res))) return;
        if (!isValidPayoutId(req.params.payoutId)) {
            return res.status(400).json({ error: "Payout ID must be a positive integer" });
        }
        const [record, threshold] = await Promise.all([
            getPayout(req.params.payoutId),
            getRequiredApprovals(),
        ]);
        if (!record) return res.status(404).json({ error: "Payout proposal not found" });
        return res.json({ success: true, ...toResponse(record, threshold) });
    } catch (error) {
        console.error("Payout status error:", error);
        return res.status(500).json({ error: "Unable to retrieve payout status", message: error.message });
    }
});

router.post("/:payoutId/approve", authenticateToken, async (req, res) => {
    try {
        if (!(await requireOrganization(req, res))) return;
        if (!isValidPayoutId(req.params.payoutId)) {
            return res.status(400).json({ error: "Payout ID must be a positive integer" });
        }
        const [record, threshold] = await Promise.all([
            getPayout(req.params.payoutId),
            getRequiredApprovals(),
        ]);
        if (!record) return res.status(404).json({ error: "Payout proposal not found" });
        if (!canApprovePayout(record, threshold)) {
            return res.status(409).json({ error: "Payout is already executed or has reached its approval threshold" });
        }
        const signerAddress = String(process.env.FLOW_ADDRESS || "").toLowerCase();
        if (signerAddress && record.approvals.some(address => address.toLowerCase() === signerAddress)) {
            return res.status(409).json({ error: "The configured signer has already approved this payout" });
        }

        const transaction = await approvePayout(req.params.payoutId);
        const [updated, updatedThreshold] = await Promise.all([
            getPayout(req.params.payoutId),
            getRequiredApprovals(),
        ]);
        if (!updated) {
            return res.status(502).json({
                error: "Approval transaction sealed but payout state could not be refreshed",
                transactionId: transaction.transactionId,
            });
        }
        return res.json({
            success: true,
            ...toResponse(updated, updatedThreshold),
            transactionId: transaction.transactionId,
        });
    } catch (error) {
        console.error("Payout approval error:", error);
        return res.status(500).json({ error: "Payout approval failed", message: error.message });
    }
});

router.post("/:payoutId/execute", authenticateToken, async (req, res) => {
    try {
        if (!(await requireOrganization(req, res))) return;
        if (!isValidPayoutId(req.params.payoutId)) {
            return res.status(400).json({ error: "Payout ID must be a positive integer" });
        }
        const [record, threshold] = await Promise.all([
            getPayout(req.params.payoutId),
            getRequiredApprovals(),
        ]);
        if (!record) return res.status(404).json({ error: "Payout proposal not found" });
        if (!canExecutePayout(record, threshold)) {
            return res.status(409).json({
                error: "Payout cannot be executed before the required approvals are collected",
                approvalCount: record.approvals.length,
                requiredApprovals: threshold,
                executed: record.executed,
            });
        }

        const transaction = await executePayout(req.params.payoutId);
        const [updated, updatedThreshold] = await Promise.all([
            getPayout(req.params.payoutId),
            getRequiredApprovals(),
        ]);
        if (!updated || !updated.executed) {
            return res.status(502).json({
                error: "Execution transaction sealed but the Flow contract does not report the payout as executed",
                transactionId: transaction.transactionId,
            });
        }
        return res.json({
            success: true,
            ...toResponse(updated, updatedThreshold),
            transactionId: transaction.transactionId,
        });
    } catch (error) {
        console.error("Payout execution error:", error);
        return res.status(500).json({ error: "Payout execution failed", message: error.message });
    }
});

export default router;
