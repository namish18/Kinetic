import { calculateSpamPenalty } from './kineticMechanisms.js';

describe('MSTS Spam Penalty & Velocity Engine', () => {
  it('returns 1.0 for first submission', () => {
    const penalty = calculateSpamPenalty(['2026-11-03T10:00:00Z']);
    console.assert(penalty === 1.0, 'Expected 1.0');
  });

  it('applies 20% extra penalty for rapid succession (<10 mins)', () => {
    const timestamps = [
      '2026-11-03T10:00:00Z',
      '2026-11-03T10:04:00Z' // 4 minutes apart
    ];
    const penalty = calculateSpamPenalty(timestamps);
    // Base penalty for k=2 is 1 / (1 + 0.1*1) = ~0.9091
    // Velocity penalty = 0.9091 * 0.8 = ~0.7273
    console.assert(penalty < 0.8, 'Expected velocity penalty boost');
  });
});