
import express from 'express';
import jwt from 'jsonwebtoken';

import {
    createFundingEpoch,
    getFundingEpochs,
    getFundingEpoch,
    updateFundingEpoch,
    activateFundingEpoch,
    finalizeFundingEpoch
} from '../services/fundingEpochService.js';

import FundingEpochScore from '../models/FundingEpochScore.js';

const router = express.Router();

function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

function handleError(res, error) {
    const message = error.message || 'Internal server error';

    let status = 400;

    if (message.includes('not found')) status = 404;
    else if (message.includes('Only organization')) status = 403;
    else if (
        message.includes('Only draft') ||
        message.includes('Only active') ||
        message.includes('cannot be finalized')
    ) status = 409;

    return res.status(status).json({ message });
}

router.use(authenticate);

// Create an epoch
router.post('/', async (req, res) => {
    try {
        const epoch = await createFundingEpoch(req.user.id, req.body || {});
        return res.status(201).json({ message: 'Funding epoch created', epoch });
    } catch (error) {
        return handleError(res, error);
    }
});

// List organization epochs
router.get('/', async (req, res) => {
    try {
        const epochs = await getFundingEpochs(req.user.id);
        return res.json({ epochs });
    } catch (error) {
        return handleError(res, error);
    }
});

// Get one epoch
router.get('/:epochId', async (req, res) => {
    try {
        const epoch = await getFundingEpoch(req.params.epochId, req.user.id);
        return res.json({ epoch });
    } catch (error) {
        return handleError(res, error);
    }
});

// Get epoch scores
router.get('/:epochId/scores', async (req, res) => {
    try {
        const epoch = await getFundingEpoch(req.params.epochId, req.user.id);
        const scores = await FundingEpochScore.find({ epoch: epoch._id });
        return res.json({ scores });
    } catch (error) {
        return handleError(res, error);
    }
});

// Update a draft epoch
router.patch('/:epochId', async (req, res) => {
    try {
        const epoch = await updateFundingEpoch(
            req.params.epochId,
            req.user.id,
            req.body || {}
        );

        return res.json({ message: 'Funding epoch updated', epoch });
    } catch (error) {
        return handleError(res, error);
    }
});

// Activate an epoch
router.post('/:epochId/activate', async (req, res) => {
    try {
        const epoch = await activateFundingEpoch(
            req.params.epochId,
            req.user.id
        );

        return res.json({ message: 'Funding epoch activated', epoch });
    } catch (error) {
        return handleError(res, error);
    }
});

// Finalize an epoch
router.post('/:epochId/finalize', async (req, res) => {
    try {
        const result = await finalizeFundingEpoch(
            req.params.epochId,
            req.user.id
        );

        return res.json({
            message: result.alreadyFinalized
                ? 'Funding epoch was already finalized'
                : 'Funding epoch finalized',
            ...result
        });
    } catch (error) {
        return handleError(res, error);
    }
});

export default router;
