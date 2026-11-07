'use client';

import React, { useState, useEffect } from 'react';

export default function AntiGamingBadge({ timestamps = [] }) {
  const [penaltyData, setPenaltyData] = useState({
    penaltyMultiplier: 1.0,
    status: 'Normal',
    loading: true,
  });

  useEffect(() => {
    async function fetchAntiGamingScore() {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
        const response = await fetch(`${backendUrl}/api/kinetic/anti-gaming-score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timestamps }),
        });

        if (response.ok) {
          const data = await response.json();
          setPenaltyData({ ...data, loading: false });
        } else {
          setPenaltyData(prev => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.error('Failed to calculate MSTS velocity penalty:', err);
        setPenaltyData(prev => ({ ...prev, loading: false }));
      }
    }

    if (timestamps.length > 0) {
      fetchAntiGamingScore();
    } else {
      setPenaltyData(prev => ({ ...prev, loading: false }));
    }
  }, [timestamps]);

  if (penaltyData.loading) {
    return <div className="text-gray-400 text-sm animate-pulse">Computing MSTS velocity vector...</div>;
  }

  const isPenaltyApplied = penaltyData.penaltyMultiplier < 1.0;
  const isHighSpamRisk = penaltyData.penaltyMultiplier < 0.8;

  return (
    <div className={`p-5 rounded-xl border transition-all duration-300 ${
      isHighSpamRisk 
        ? 'bg-red-950/30 border-red-500/40 text-red-200' 
        : isPenaltyApplied 
        ? 'bg-amber-950/30 border-amber-500/40 text-amber-200' 
        : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-wider font-mono opacity-70">Anti-Gaming Vector</span>
          <h4 className="text-base font-semibold">MSTS Score Multiplier</h4>
        </div>
        <span className="font-mono text-2xl font-bold">
          {(penaltyData.penaltyMultiplier * 100).toFixed(1)}%
        </span>
      </div>

      <div className="mt-3 text-xs flex items-center gap-2">
        <span className="opacity-70">Submission Velocity Status:</span>
        <span className="font-semibold px-2 py-0.5 rounded bg-black/40 border border-white/10">
          {penaltyData.status}
        </span>
      </div>

      {isPenaltyApplied && (
        <p className="mt-3 text-xs leading-relaxed text-amber-300/90 bg-amber-900/40 p-2.5 rounded-lg border border-amber-500/20">
          ⚠️ <strong>Diminishing Returns Active:</strong> Submissions detected under the 10-minute threshold. Maintain regular velocity to restore 100% impact value.
        </p>
      )}
    </div>
  );
}