"use client";
import React, { useState } from "react";
import {
  GitPullRequest,
  Clock,
  CheckCircle,
  Wallet,
  TrendingUp,
  Calendar,
  ExternalLink,
  Plus,
  ArrowUpRight,
  BarChart3,
  Activity,
  Timer,
  ChevronRight,
  FileText,
  Search,
  Award,
  Zap,
  Globe,
  Archive,
  ArrowRight
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
  id: string;
  title: string;
  repo: string;
  status: PRStatus;
  mstsScore: number;
  date: string;
  link: string;
}

const mockPRs: ContributorPR[] = [
  { id: "PR-901", title: "Refactor core encryption module", repo: "go-ipfs", status: "payout", mstsScore: 94, date: "2026-03-01", link: "#" },
  { id: "PR-912", title: "Add DHT node discovery optimization", repo: "libp2p", status: "eligible", mstsScore: 88, date: "2026-03-05", link: "#" },
  { id: "PR-944", title: "Fix peer routing table churn", repo: "rust-libp2p", mstsScore: 0, status: "merged", date: "2026-03-08", link: "#" },
  { id: "PR-955", title: "Implement CID-based auth headers", repo: "lotus", mstsScore: 0, status: "submitted", date: "2026-03-11", link: "#" },
];

const statusOrder: PRStatus[] = ["submitted", "merged", "eligible", "payout"];

export default function ContributorDashboardPage() {
  const currentCycle = 5;
  const currentWeek = 4;

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
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Global Rank</span>
            <span className="text-sm font-black font-mono">#14 / 8,402</span>
          </div>
          <div className="h-10 w-[1px] bg-border mx-2 hidden sm:block" />
          <button className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-glow-sm">
            <GitPullRequest className="w-4 h-4" />
            Submit New Contribution
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">MSTS Score</span>
            <div className="p-2 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-black font-mono">92/100</div>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Top 2% of ecosystem contributors</p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Est. Payout</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <IconFlow />
            </div>
          </div>
          <div className="text-4xl font-black font-mono">450 FLOW</div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-bold mt-2">
            <ArrowUpRight className="w-3 h-3" />
            +$3,105.00 USD
          </div>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Cycle</span>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <Timer className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-black font-mono">C5 · W4</div>
          <p className="text-xs text-muted-foreground mt-2 font-medium">Payout in 12 days (Mar 31)</p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">GitHub PRs</span>
            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="text-4xl font-black font-mono">18 Total</div>
          <p className="text-xs text-muted-foreground mt-2 font-medium">4 eligible for this cycle</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Feed: PR Pipeline */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <GitPullRequest className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-black tracking-tight">PR Pipeline Tracking</h2>
              </div>
              <div className="bg-muted/50 px-4 py-1.5 rounded-full text-xs font-bold text-muted-foreground">
                Live Data Synchronized
              </div>
            </div>

            <div className="space-y-6">
              {mockPRs.map((pr) => {
                const currentIdx = statusOrder.indexOf(pr.status);
                return (
                  <div key={pr.id} className="p-6 bg-background border border-border rounded-3xl hover:border-primary/30 hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-muted text-[10px] font-bold font-mono rounded text-muted-foreground">{pr.id}</span>
                          <span className="text-sm font-bold text-primary italic font-serif">{pr.repo}</span>
                        </div>
                        <h4 className="text-lg font-black leading-tight group-hover:text-primary transition-colors">{pr.title}</h4>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {pr.mstsScore > 0 && (
                          <div className="bg-primary/15 text-primary px-3 py-1 rounded-xl text-xs font-black font-mono flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5" />
                            {pr.mstsScore} pts
                          </div>
                        )}
                        <span className="text-xs font-bold text-muted-foreground uppercase">{pr.date}</span>
                        <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
                      </div>
                    </div>

                    {/* Step Visualizer */}
                    <div className="flex items-center gap-1">
                      {statusOrder.map((s, idx) => {
                        const reached = idx <= currentIdx;
                        const isCurrent = idx === currentIdx;
                        return (
                          <React.Fragment key={s}>
                            <div className={`flex items-center justify-center px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${reached
                                ? isCurrent
                                  ? 'bg-primary text-primary-foreground border-primary shadow-glow-sm'
                                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-muted/30 text-muted-foreground/30 border-transparent'
                              }`}>
                              {s === 'payout' && <IconFlow />}
                              <span className="ml-1.5">{s}</span>
                            </div>
                            {idx < statusOrder.length - 1 && (
                              <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${reached ? 'text-primary' : 'text-muted/10'}`} />
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

          {/* Audit Archive Tracker */}
          <div className="bg-[#050505] text-white border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <Archive className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-black tracking-tight">IPFS Payout Records</h2>
              </div>
              <div className="space-y-4">
                {[
                  { cycle: "C4 (Jan 15)", cid: "bafy...7391", amount: "320 FLOW", hash: "0x892...e421" },
                  { cycle: "C3 (Nov 30)", cid: "bafy...2844", amount: "510 FLOW", hash: "0x124...9012" },
                ].map((audit, i) => (
                  <div key={i} className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/[0.08] transition-all cursor-pointer group/item">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover/item:border-primary transition-all">
                        <Globe className="w-6 h-6 opacity-40 group-hover/item:opacity-100 group-hover/item:text-primary transition-all" />
                      </div>
                      <div>
                        <div className="text-sm font-black">{audit.cycle}</div>
                        <div className="text-xs font-mono text-white/40 truncate w-32 md:w-auto">{audit.cid}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-emerald-400 font-mono">{audit.amount}</div>
                      <div className="text-[10px] font-bold text-white/20 font-mono uppercase truncate">{audit.hash}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-6 py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all">
                Export Transparency Report
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar: Earnings & Wallet */}
        <div className="space-y-8">
          {/* Earnings Panel */}
          <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Wallet className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold font-heading">Financial insights</h2>
            </div>

            <div className="space-y-8">
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-2">Cycle Pending</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black font-mono">450.00</span>
                  <span className="text-sm font-bold text-muted-foreground">FLOW</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-2">Total Lifetime Rewards</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black font-mono">2,140.00</span>
                  <span className="text-sm font-bold text-muted-foreground">FLOW</span>
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-muted-foreground">Connected Wallet</span>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    FLOW ACTIVE
                  </div>
                </div>
                <div className="p-4 bg-muted/30 border border-border rounded-2xl flex items-center justify-between group cursor-pointer hover:border-primary/40 transition-all">
                  <div className="font-mono text-sm font-bold text-muted-foreground truncate w-32">0x7a3...e42f</div>
                  <Search className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          </div>

          {/* Cycle Roadmap Progress */}
          <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <Calendar className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold font-heading">Cycle #5 Progress</h2>
            </div>

            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map((w) => (
                <div key={w} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${w < currentWeek
                      ? 'bg-primary text-primary-foreground border-primary'
                      : w === currentWeek
                        ? 'bg-primary/20 text-primary border-primary animate-pulse'
                        : 'bg-muted/30 text-muted-foreground border-border'
                    }`}>
                    {w < currentWeek ? <CheckCircle className="w-4 h-4" /> : `W${w}`}
                  </div>
                  <div className="flex-1">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      {w <= currentWeek && <div className="h-full bg-primary" style={{ width: w < currentWeek ? '100%' : '60%' }} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-2xl text-[10px] font-bold text-primary text-center uppercase tracking-widest">
              Snapshot Phase begins in 8 days
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
