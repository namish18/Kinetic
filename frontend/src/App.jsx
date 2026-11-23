import React, { useState } from 'react';
import AntiGamingBadge from './components/AntiGamingBadge';
import OrbitingEcosystem from './components/OrbitingEcosystem';
import { getOrCreateContributorIdentity, exportContributorKeyBackup } from './lib/identity';

function App() {
  const [wallet, setWallet] = useState(null);
  const [identity] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return getOrCreateContributorIdentity('demo-contributor');
      } catch (err) {
        console.warn('Failed to initialize contributor identity:', err);
        return null;
      }
    }
    return null;
  });
  
  // Sample timestamps submitted within 4 mins to test velocity penalty UI
  const samplePRTimestamps = [
    '2026-11-03T10:00:00Z',
    '2026-11-03T10:04:00Z'
  ];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0c',
      color: '#f3f4f6',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '40px 24px',
      boxSizing: 'border-box'
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* TOP HEADER */}
        <header style={{
          display: 'flex',
          justifyConstraint: 'space-between',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '32px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{
                fontSize: '2rem',
                fontWeight: '800',
                margin: 0,
                background: 'linear-gradient(90deg, #ffffff 0%, #00f2fe 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                KINETIC
              </h1>
              <span style={{
                background: 'rgba(0, 242, 254, 0.1)',
                color: '#00f2fe',
                border: '1px solid rgba(0, 242, 254, 0.3)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '700',
                fontFamily: 'monospace'
              }}>
                MSTS v2 ENGINE
              </span>
            </div>
            <p style={{ color: '#9ca3af', margin: '6px 0 0 0', fontSize: '0.9rem' }}>
              Meritocratic Funding Engine & Proof-of-Build Verification Gate
            </p>
          </div>

          <button 
            onClick={() => setWallet(wallet ? null : '0x01cf0e2f2f715450')}
            style={{
              background: wallet ? 'rgba(16, 185, 129, 0.15)' : 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              color: wallet ? '#10b981' : '#000',
              border: wallet ? '1px solid rgba(16, 185, 129, 0.4)' : 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: wallet ? 'none' : '0 4px 14px rgba(0, 242, 254, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            {wallet ? `Connected: ${wallet}` : 'Connect Flow Wallet'}
          </button>
        </header>

        {/* METRIC CARDS GRID */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          marginBottom: '40px'
        }}>
          {/* CARD 1: TREASURY */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>
              FLOW CADENCE TREASURY
            </span>
            <div style={{ fontSize: '2.5rem', fontWeight: '800', fontFamily: 'monospace', color: '#10b981', marginTop: '10px' }}>
              12,450.00 <span style={{ fontSize: '1rem', color: '#9ca3af' }}>FLOW</span>
            </div>
            <div style={{ marginTop: '16px', fontSize: '0.8rem', color: '#6b7280', fontFamily: 'monospace' }}>
              Contract: <span style={{ color: '#d1d5db' }}>KineticPayout.cdc</span>
            </div>
          </div>

          {/* CARD 2: PROOF-OF-BUILD */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>
              VERIFICATION GATE
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#00f2fe', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ✓ Proof-of-Build Verified
            </div>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '10px', lineHeight: '1.4' }}>
              GitHub Actions build trace confirmed for commit <code style={{ background: 'rgba(0, 242, 254, 0.1)', color: '#00f2fe', padding: '2px 6px', borderRadius: '4px' }}>71af535</code>.
            </p>
          </div>

          {/* CARD 3: ANTI-GAMING */}
          <div>
            <AntiGamingBadge timestamps={samplePRTimestamps} />
          </div>

          {/* CARD 4: CONTRIBUTOR-CONTROLLED IDENTITY (DID-01) */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>
                CONTRIBUTOR-CONTROLLED IDENTITY (DID-01)
              </span>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#10b981', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                Self-Sovereign did:key
              </div>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '8px', fontFamily: 'monospace', wordBreak: 'break-all', background: 'rgba(255, 255, 255, 0.03)', padding: '8px', borderRadius: '6px' }}>
                {identity?.did || 'Generating contributor keypair...'}
              </p>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '6px' }}>
                Custody: <span style={{ color: '#00f2fe' }}>Contributor Client (Browser)</span>
              </div>
            </div>

            <button
              onClick={() => exportContributorKeyBackup('demo-contributor')}
              style={{
                marginTop: '16px',
                background: 'rgba(0, 242, 254, 0.1)',
                border: '1px solid rgba(0, 242, 254, 0.3)',
                color: '#00f2fe',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: 'fit-content'
              }}
            >
              Export Private Key Backup ↓
            </button>
          </div>
        </div>

        {/* ECOSYSTEM VISUALIZER SECTION */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '20px',
          padding: '32px 24px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#e5e7eb' }}>
            Protocol Labs & Flow Infrastructure
          </h3>
          <p style={{ margin: '6px 0 20px 0', fontSize: '0.85rem', color: '#6b7280' }}>
            Multi-signal triangulation via Ceramic DIDs, IPFS, and Flow Smart Contracts
          </p>
          <OrbitingEcosystem />
        </div>

      </div>
    </div>
  );
}

export default App;