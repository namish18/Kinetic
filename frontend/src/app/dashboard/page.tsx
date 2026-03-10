"use client";
import React, { useState } from "react";
import {
  GitPullRequest,
  Clock,
  CheckCircle,
  DollarSign,
  Wallet,
  TrendingUp,
  Calendar,
  ExternalLink,
  X,
  Plus,
  ArrowUpRight,
  BarChart3,
  Activity,
  Timer,
  ChevronRight,
  FileText,
  CircleDot,
  Award,
} from "lucide-react";

/* ───────── inline SVG icon components (no emoji) ───────── */
const IconSubmitted = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="8" cy="8" r="3" fill="currentColor" />
  </svg>
);
const IconMerged = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
    <path d="M5 3v10M5 3a2 2 0 100-4 2 2 0 000 4zM5 13a2 2 0 100 4 2 2 0 000-4z" stroke="currentColor" strokeWidth="1.2" transform="translate(0,-1) scale(0.9)" />
    <path d="M11 3a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.2" transform="translate(0,-1) scale(0.9)" />
    <path d="M5 5c2 2 4 2 6 0" stroke="currentColor" strokeWidth="1.2" transform="translate(0,-1) scale(0.9)" />
  </svg>
);
const IconEligible = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
    <path d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7L8 1z" stroke="currentColor" strokeWidth="1.2" fill="none" />
  </svg>
);
const IconPaid = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ───────── types ───────── */
type PRStatus = "Submitted" | "Merged" | "Eligible" | "Paid";

interface PR {
  id: string;
  title: string;
  repo: string;
  status: PRStatus;
  valueScore: number;
  date: string;
  link: string;
}

interface CycleHistoryItem {
  cycle: number;
  startDate: string;
  endDate: string;
  totalPRs: number;
  avgScore: number;
  payout: string;
}

/* ───────── mock data ───────── */
const mockPRs: PR[] = [
  { id: "PR-1247", title: "Fix memory leak in event loop handler", repo: "node/node", status: "Paid", valueScore: 4.8, date: "2026-02-28", link: "#" },
  { id: "PR-1312", title: "Add WebSocket compression support", repo: "deno/deno", status: "Eligible", valueScore: 4.2, date: "2026-03-01", link: "#" },
  { id: "PR-1389", title: "Optimize bundle splitting algorithm", repo: "vitejs/vite", status: "Merged", valueScore: 3.9, date: "2026-03-04", link: "#" },
  { id: "PR-1401", title: "Implement lazy hydration for islands", repo: "withastro/astro", status: "Submitted", valueScore: 0, date: "2026-03-08", link: "#" },
  { id: "PR-1205", title: "Refactor CSS parser for container queries", repo: "tailwindlabs/tailwindcss", status: "Paid", valueScore: 4.5, date: "2026-02-20", link: "#" },
  { id: "PR-1190", title: "Add streaming SSR support", repo: "vercel/next.js", status: "Paid", valueScore: 5.0, date: "2026-02-15", link: "#" },
];

const cycleHistory: CycleHistoryItem[] = [
  { cycle: 4, startDate: "Jan 6", endDate: "Feb 16", totalPRs: 8, avgScore: 4.3, payout: "14.2 FIL" },
  { cycle: 3, startDate: "Nov 25", endDate: "Jan 5", totalPRs: 5, avgScore: 3.8, payout: "9.7 FIL" },
  { cycle: 2, startDate: "Oct 14", endDate: "Nov 24", totalPRs: 6, avgScore: 4.1, payout: "11.8 FIL" },
  { cycle: 1, startDate: "Sep 2", endDate: "Oct 13", totalPRs: 4, avgScore: 3.5, payout: "7.3 FIL" },
];

const statusConfig: Record<PRStatus, { color: string; bg: string; border: string }> = {
  Submitted: { color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30" },
  Merged: { color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/30" },
  Eligible: { color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/30" },
  Paid: { color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
};

const statusIcons: Record<PRStatus, React.ReactNode> = {
  Submitted: <IconSubmitted />,
  Merged: <IconMerged />,
  Eligible: <IconEligible />,
  Paid: <IconPaid />,
};

const statusOrder: PRStatus[] = ["Submitted", "Merged", "Eligible", "Paid"];

/* ───────── Component ───────── */
export default function DeveloperDashboardPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [weeklyLinks, setWeeklyLinks] = useState<string[]>(["", "", ""]);
  const currentWeek = 4;
  const cycleNumber = 5;

  const addLinkField = () => setWeeklyLinks([...weeklyLinks, ""]);
  const updateLink = (i: number, v: string) => {
    const copy = [...weeklyLinks];
    copy[i] = v;
    setWeeklyLinks(copy);
  };
  const removeLink = (i: number) => {
    const copy = weeklyLinks.filter((_, idx) => idx !== i);
    setWeeklyLinks(copy.length ? copy : [""]);
  };

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
      {/* ── Header ── */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black font-heading">Developer Dashboard</h1>
        </div>
        <p className="text-muted-foreground text-lg ml-[52px]">Track contributions, monitor payout cycles, and manage your PR submissions.</p>
      </div>

      {/* ── Top Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* FIL Balance */}
        <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-3">
              <Wallet className="w-4 h-4" />
              <span>FIL Balance</span>
            </div>
            <div className="text-3xl font-black font-mono">42.84</div>
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              <span>$214.20 USD</span>
              <span className="text-emerald-400 text-xs ml-1 flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" />
                +3.2%
              </span>
            </div>
          </div>
        </div>

        {/* Current Cycle */}
        <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-3">
              <Calendar className="w-4 h-4" />
              <span>Current Cycle</span>
            </div>
            <div className="text-3xl font-black font-mono">#{cycleNumber}</div>
            <div className="text-sm text-muted-foreground mt-1">Week {currentWeek} of 6</div>
          </div>
        </div>

        {/* Total PRs This Cycle */}
        <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-3">
              <GitPullRequest className="w-4 h-4" />
              <span>PRs This Cycle</span>
            </div>
            <div className="text-3xl font-black font-mono">{mockPRs.length}</div>
            <div className="text-sm text-muted-foreground mt-1">{mockPRs.filter(p => p.status === "Paid").length} paid out</div>
          </div>
        </div>

        {/* Average Value Score */}
        <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
          <div className="relative">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium mb-3">
              <BarChart3 className="w-4 h-4" />
              <span>Avg Value Score</span>
            </div>
            <div className="text-3xl font-black font-mono">4.28</div>
            <div className="text-sm text-muted-foreground mt-1">out of 5.0</div>
          </div>
        </div>
      </div>

      {/* ── 6‐Week Contribution Cycle Progress ── */}
      <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold font-heading">6-Week Contribution Cycle</h2>
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <FileText className="w-4 h-4" />
            Weekly Sheet
          </button>
        </div>
        <div className="flex items-center gap-2 mb-3">
          {[1, 2, 3, 4, 5, 6].map((week) => (
            <div key={week} className="flex-1 flex flex-col items-center gap-2">
              <div
                className={`w-full h-2.5 rounded-full transition-colors ${
                  week < currentWeek
                    ? "bg-primary"
                    : week === currentWeek
                    ? "bg-primary/60 animate-pulse"
                    : "bg-muted"
                }`}
              />
              <span className={`text-xs font-mono ${week === currentWeek ? "text-primary font-bold" : "text-muted-foreground"}`}>
                W{week}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
          <span>Cycle #{cycleNumber} started Feb 17, 2026</span>
          <span>Payout: Mar 31, 2026</span>
        </div>
      </div>

      {/* ── PR Merge Status Tracker ── */}
      <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-5">
          <GitPullRequest className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold font-heading">PR Merge Status Tracker</h2>
        </div>
        <div className="space-y-4">
          {mockPRs.map((pr) => {
            const currentIdx = statusOrder.indexOf(pr.status);
            return (
              <div key={pr.id} className="bg-background/60 border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{pr.id}</span>
                      <span className="text-xs text-muted-foreground">{pr.repo}</span>
                    </div>
                    <h4 className="font-semibold text-sm truncate">{pr.title}</h4>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {pr.valueScore > 0 && (
                      <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-xs font-bold">
                        <Award className="w-3 h-3" />
                        {pr.valueScore}/5
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">{pr.date}</span>
                    <a href={pr.link} className="text-muted-foreground hover:text-foreground transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
                {/* Pipeline badges */}
                <div className="flex items-center gap-1">
                  {statusOrder.map((s, idx) => {
                    const reached = idx <= currentIdx;
                    const isCurrent = idx === currentIdx;
                    const cfg = statusConfig[s];
                    return (
                      <React.Fragment key={s}>
                        <div
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            reached
                              ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                              : "bg-muted/30 text-muted-foreground border-transparent"
                          } ${isCurrent ? "ring-1 ring-offset-1 ring-offset-background ring-current" : ""}`}
                        >
                          {statusIcons[s]}
                          <span className="hidden sm:inline">{s}</span>
                        </div>
                        {idx < statusOrder.length - 1 && (
                          <ChevronRight className={`w-3 h-3 shrink-0 ${reached ? "text-muted-foreground" : "text-muted-foreground/30"}`} />
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

      {/* ── Payout & Contribution History ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* FIL Payout Card */}
        <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Wallet className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold font-heading">Payout Details</h2>
          </div>
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-6 mb-5">
            <div className="text-sm text-muted-foreground mb-2">Available Balance</div>
            <div className="text-4xl font-black font-mono mb-1">42.84 FIL</div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">$214.20 USD</span>
              <span className="text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                1 FIL = $5.00
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pending this cycle</span>
              <span className="font-semibold font-mono">~8.4 FIL</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total earned (all time)</span>
              <span className="font-semibold font-mono">85.84 FIL</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Wallet address</span>
              <span className="font-mono text-xs text-muted-foreground">0x7a3b...e42f</span>
            </div>
          </div>
        </div>

        {/* Contribution History */}
        <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold font-heading">Cycle History</h2>
          </div>
          <div className="space-y-3">
            {cycleHistory.map((c) => (
              <div key={c.cycle} className="bg-background/60 border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <CircleDot className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold text-sm">Cycle #{c.cycle}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{c.startDate} – {c.endDate}</span>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono text-sm">{c.payout}</div>
                  <div className="text-xs text-muted-foreground">{c.totalPRs} PRs · Avg {c.avgScore}/5</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Weekly Contributor Sheet Modal ── */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSheetOpen(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSheetOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-bold font-heading">Weekly Contributor Sheet</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Submit your merged PR links for Week {currentWeek} of Cycle #{cycleNumber}.</p>

            <div className="space-y-3 mb-6">
              {weeklyLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => updateLink(i, e.target.value)}
                    placeholder="https://github.com/org/repo/pull/123"
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                  />
                  <button onClick={() => removeLink(i)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button onClick={addLinkField} className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:opacity-80 transition-opacity mb-6">
              <Plus className="w-4 h-4" />
              Add another PR link
            </button>

            <div className="flex justify-end gap-3">
              <button onClick={() => setSheetOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors">
                Cancel
              </button>
              <button className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
                Submit PRs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
