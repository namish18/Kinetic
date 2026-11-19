'use client';

import React from 'react';

export default function OrbitingEcosystem() {
  const partners = [
    { name: 'Flow Blockchain', role: 'Settlement Layer', color: 'from-emerald-400 to-teal-500' },
    { name: 'Protocol Labs', role: 'DID & Storage', color: 'from-cyan-400 to-blue-500' },
    { name: 'IPFS / Helia', role: 'Immutable Snapshots', color: 'from-blue-400 to-indigo-500' },
    { name: 'Ceramic Network', role: 'Verifiable Data Streams', color: 'from-purple-400 to-pink-500' },
  ];

  return (
    <div className="relative w-full max-w-2xl mx-auto py-12 flex flex-col items-center justify-center">
      {/* Central Kinetic Nucleus */}
      <div className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-400 p-0.5 shadow-2xl shadow-cyan-500/20">
        <div className="w-full h-full bg-[#0a0a0c] rounded-full flex flex-col items-center justify-center text-center p-2">
          <span className="text-xs font-mono font-bold tracking-widest text-cyan-400">KINETIC</span>
          <span className="text-[10px] text-gray-400 font-mono">MSTS v2</span>
        </div>
      </div>

      {/* Ecosystem Nodes Grid */}
      <div className="grid grid-cols-2 gap-4 mt-8 w-full">
        {partners.map((partner, i) => (
          <div key={i} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-md hover:border-white/20 transition-all">
            <div className={`h-1 w-8 rounded bg-gradient-to-r ${partner.color} mb-2`} />
            <h5 className="font-medium text-sm text-gray-200">{partner.name}</h5>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{partner.role}</p>
          </div>
        ))}
      </div>
    </div>
  );
}