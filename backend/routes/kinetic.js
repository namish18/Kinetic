import express from 'express';
import { calculateSpamPenalty } from '../services/kineticMechanisms.js';

const router = express.Router();

// GET /api/kinetic/anti-gaming-score
router.post('/anti-gaming-score', (req, res) => {
  const { timestamps } = req.body;
  
  if (!Array.isArray(timestamps)) {
    return res.status(400).json({ error: 'timestamps array required' });
  }

  const penalty = calculateSpamPenalty(timestamps);
  res.status(200).json({
    penaltyMultiplier: penalty,
    status: penalty < 0.8 ? 'Velocity Penalty Applied' : 'Normal',
  });
});

export default router;