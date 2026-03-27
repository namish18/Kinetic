"use client";
import React, { useState, useEffect } from "react";
import {
  GitPullRequest,
  CheckCircle,
  Wallet,
  ExternalLink,
  ArrowUpRight,
  BarChart3,
  Activity,
  Timer,
  Award,
  Zap,
  ArrowRight,
  RefreshCcw,
  Loader2,
  LogOut,
} from "lucide-react";

/* ───────── Flow & IPFS Themed Icons ───────── */
const IconFlow = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
    <path d="M10 2L2 10l8 8 8-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 6l-4 4 4 4 4-4-4-4z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1" />
  </svg>
);

/* ───────── Types ───────── */
type PRStatus = "submitted" | "merged" | "eligible" | "payout";

interface ContributorPR {
  id: string | number;
  title: string;
  repo: string;
  status: PRStatus | string;
  score: number;
  date: string;
  link: string;
}

const statusOrder: PRStatus[] = ["submitted", "merged", "eligible", "payout"];

export default function ContributorDashboardPage() {
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [scoreData, setScoreData] = useState<any>(null);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const fetchData = async (authToken: string) => {
    setLoading(true);
    try {
        // Fetch Contribution Score (Real data from algorithm)
        const scoreRes = await fetch("http://localhost:5000/api/contribution/me", {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        const sData = await scoreRes.json();
        if (sData.success) {
            setScoreData(sData);
        }


    } catch (e) {
        console.error("Fetch error:", e);
    } finally {
        setLoading(false);
    }
  };

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        let t = urlParams.get("token") || localStorage.getItem("token") || "";
        if (t) {
            setToken(t);
            localStorage.setItem("token", t);
            fetchData(t);
            // Clean up URL to hide the token and keep it secure
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);



  if (loading && !scoreData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-6">
                <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <Zap className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-black tracking-tight mb-2">Syncing Your GitHub Contributions</h2>
                    <p className="text-muted-foreground animate-pulse">Running Final Valuation Algorithm...</p>
                </div>
            </div>
        </div>
      );
  }

  const finalScore = scoreData?.finalScore || 0;
  const prs = scoreData?.prs || [];
  const payout = Math.round(finalScore * 5); // Example multiplier

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 md:px-8 max-w-[1440px] mx-auto w-full font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-glow-sm">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Contributor Alpha</h1>
          </div>
          <p className="text-muted-foreground text-lg ml-1">Building the Decentralized Web · Protocol Labs Network</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => fetchData(token)}
            className="p-3 rounded-2xl bg-secondary hover:bg-secondary/80 transition-all"
            title="Refresh Data"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
          </button>
          <div className="h-10 w-[1px] bg-border mx-2" />
          <button className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-glow-sm">
            <GitPullRequest className="w-4 h-4" />
            Submit New Contribution
          </button>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-3 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all border border-destructive/20"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Contribution Score</span>
            <div className="p-2 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-black font-mono">{finalScore}/100</div>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Reputation scaled by network influence</p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Est. Payout</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <IconFlow />
            </div>
          </div>
          <div className="text-4xl font-black font-mono">{payout} FLOW</div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-bold mt-2">
            <ArrowUpRight className="w-3 h-3" />
            Active Reward Pool
          </div>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Cycle</span>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <Timer className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-black font-mono">C1 · LIVE</div>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Snapshot in progress...</p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tracked PRs</span>
            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-black font-mono">{prs.length} Total</div>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Synced from Git history</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          

          {/* Real PR Pipeline Tracking */}
          <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <GitPullRequest className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-black tracking-tight">Algorithmic Valuation</h2>
              </div>
              <div className="bg-emerald-500/10 px-4 py-1.5 rounded-full text-[10px] font-black text-emerald-500 uppercase tracking-widest border border-emerald-500/20">
                Verified On-Chain
              </div>
            </div>

            <div className="space-y-6">
              {prs.length === 0 ? (
                  <div className="text-center py-12">
                      <p className="text-muted-foreground italic">No recently merged PRs found for your account.</p>
                  </div>
              ) : prs.map((pr: any) => {
                return (
                  <div key={pr.id} className="p-6 bg-background border border-border rounded-3xl hover:border-primary/30 hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-muted text-[10px] font-bold font-mono rounded text-muted-foreground">PR-{pr.id}</span>
                          <span className="text-sm font-bold text-primary italic font-serif">{pr.repo}</span>
                        </div>
                        <h4 className="text-lg font-black leading-tight group-hover:text-primary transition-colors">{pr.title}</h4>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="bg-primary/15 text-primary px-3 py-1 rounded-xl text-xs font-black font-mono flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5" />
                            {pr.score} pts
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">{pr.date}</span>
                        <a href={pr.link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {statusOrder.map((s, idx) => {
                        const reached = true;
                        const isCurrent = s === 'merged' || s === 'eligible';
                        return (
                          <React.Fragment key={s}>
                            <div className={`flex items-center justify-center px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${isCurrent
                                  ? 'bg-primary text-primary-foreground border-primary shadow-glow-sm'
                                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              }`}>
                              {s === 'payout' && <IconFlow />}
                              <span className="ml-1.5">{s}</span>
                            </div>
                            {idx < statusOrder.length - 1 && (
                              <ArrowRight className="w-3.5 h-3.5 shrink-0 text-primary" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Earnings Panel */}
          <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Wallet className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold font-heading">Protocol Rewards</h2>
            </div>
            <div className="space-y-8">
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-2">Algorithm Value Generated</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black font-mono">{payout}</span>
                  <span className="text-sm font-bold text-muted-foreground">FLOW</span>
                </div>
              </div>
              <div className="pt-6 border-t border-border">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-muted-foreground">Network Status</span>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* New Algorithm Card */}
          <div className="bg-[#050505] text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl rounded-full" />
            <div className="relative z-10">
                <h3 className="text-xl font-black mb-4">Valuation Logic</h3>
                <p className="text-xs text-white/60 mb-6 leading-relaxed">
                    Kinetic uses the <span className="text-primary font-bold">Final Valuation Algorithm</span> to price software artifacts based on log-scaled complexity, verified impact metrics, and network reputation.
                </p>
                <div className="space-y-3">
                    {['Complexity Scaling', 'Reputation Multiplier', 'Anti-Spam Filter'].map(item => (
                        <div key={item} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/50">
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            {item}
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
