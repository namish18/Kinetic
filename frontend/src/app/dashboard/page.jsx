'use client';

import React, { useState, useEffect } from 'react';
import AntiGamingBadge from '../../components/AntiGamingBadge';
import OrbitingEcosystem from '../../components/OrbitingEcosystem';
import { getTreasuryBalance, authenticateWallet, subscribeToUser } from '../../lib/flow';

export default function DashboardPage() {
  const [user, setUser] = useState({ loggedIn: false, addr: null });
  const [treasury, setTreasury] = useState('0.00');
  
  // Example historical PR timestamps to trigger MSTS calculation engine
  const prTimestamps = [
    '2026-11-03T10:00:00Z',
    '2026-11-03T10:04:00Z'
  ];

  useEffect(() => {
    subscribeToUser(setUser);
    async function loadTreasury() {
      const balance = await getTreasuryBalance();
      setTreasury(balance);
    }
    loadTreasury();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-500 bg-clip-text text-transparent">
            Kinetic Contributor Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Proof-of-Build CI/CD & MSTS Meritocratic Payout Engine
          </p>
        </div>

        {/* Flow Wallet Auth Button */}
        <div className="flex items-center gap-3">
          {user.loggedIn ? (
            <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/30 px-4 py-2 rounded-lg text-xs font-mono text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {user.addr}
            </div>
          ) : (
            <button
              onClick={authenticateWallet}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-500/20"
            >
              Connect Flow Wallet
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Treasury Card */}
        <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.01] flex flex-col justify-between">
          <div>
            <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Flow Cadence Treasury</span>
            <div className="mt-2 text-4xl font-extrabold font-mono text-emerald-400">
              {treasury} <span className="text-sm text-gray-400">FLOW</span>
            </div>
          </div>
          <div className="mt-6 text-xs text-gray-400 font-mono">
            Smart Contract: <span className="text-gray-300">KineticPayout.cdc</span>
          </div>
        </div>

        {/* Proof-of-Build Status */}
        <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.01] flex flex-col justify-between">
          <div>
            <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Verification Gate</span>
            <div className="mt-2 text-xl font-semibold text-cyan-400 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Proof-of-Build Verified
            </div>
            <p className="mt-2 text-xs text-gray-400 leading-relaxed">
              GitHub Actions build trace confirmed for commit hash <code className="text-cyan-300 bg-cyan-950/40 px-1 py-0.5 rounded">71af535</code>.
            </p>
          </div>
          <div className="mt-4 text-[11px] text-gray-500 font-mono">
            Protocol Labs DID Provider: ed25519
          </div>
        </div>

        {/* MSTS Anti-Gaming Badge */}
        <div className="md:col-span-1">
          <AntiGamingBadge timestamps={prTimestamps} />
        </div>
      </div>

      {/* Ecosystem Architecture Visualizer */}
      <section className="pt-6 border-t border-white/10">
        <div className="text-center max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-gray-200">Protocol Labs & Flow Infrastructure</h3>
          <p className="text-xs text-gray-400 mt-1">Multi-signal triangulation via decentralized identity and on-chain treasury settlement.</p>
        </div>
        <OrbitingEcosystem />
      </section>
    </div>
  );
}