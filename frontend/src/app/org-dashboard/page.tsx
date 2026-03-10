"use client";
import React, { useState } from "react";
import {
    Building2,
    Wallet,
    Users,
    GitPullRequest,
    ShieldAlert,
    CheckCircle,
    Clock,
    ArrowRight,
    ExternalLink,
    Award,
    TrendingUp,
    ChevronDown,
    AlertTriangle,
    Lock,
    Unlock,
    Send,
    BarChart3,
    Eye,
    Crown,
    Medal,
    Target,
} from "lucide-react";

/* ───────── inline SVG icons ───────── */
const IconSignature = ({ filled }: { filled: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
        <rect x="2" y="2" width="16" height="16" rx="4" stroke={filled ? "currentColor" : "currentColor"} strokeWidth="1.5" opacity={filled ? 1 : 0.3} />
        {filled && <path d="M6 10l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
);

const IconAIWarning = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
        <path d="M9 1L1 16h16L9 1z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
        <path d="M9 7v3M9 12.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

/* ───────── types ───────── */
type PayoutState = "Pending" | "Approved" | "Released";

interface OrgContributor {
    rank: number;
    name: string;
    handle: string;
    valueScore: number;
    prs: number;
    avatar: string;
}

interface OrgPR {
    id: string;
    title: string;
    author: string;
    repo: string;
    score: number;
    date: string;
    aiFlag: boolean;
    status: "Reviewed" | "Pending" | "Flagged";
}

/* ───────── mock data ───────── */
const orgContributors: OrgContributor[] = [
    { rank: 1, name: "Alice Chen", handle: "@alicedev", valueScore: 4.9, prs: 12, avatar: "A" },
    { rank: 2, name: "Bob Martinez", handle: "@bobcodes", valueScore: 4.6, prs: 9, avatar: "B" },
    { rank: 3, name: "Carol Johnson", handle: "@caroljdev", valueScore: 4.3, prs: 11, avatar: "C" },
    { rank: 4, name: "David Park", handle: "@dpark", valueScore: 4.1, prs: 7, avatar: "D" },
    { rank: 5, name: "Eve Williams", handle: "@evew", valueScore: 3.9, prs: 8, avatar: "E" },
    { rank: 6, name: "Frank Liu", handle: "@frankliu", valueScore: 3.7, prs: 5, avatar: "F" },
];

const orgPRs: OrgPR[] = [
    { id: "PR-2001", title: "Implement distributed caching layer", author: "@alicedev", repo: "acme/platform", score: 4.8, date: "2026-03-08", aiFlag: false, status: "Reviewed" },
    { id: "PR-2014", title: "Add OAuth 2.1 PKCE support", author: "@bobcodes", repo: "acme/auth", score: 4.5, date: "2026-03-07", aiFlag: false, status: "Reviewed" },
    { id: "PR-2027", title: "Rewrite test suite with new assertions", author: "@ghost_user", repo: "acme/core", score: 3.2, date: "2026-03-06", aiFlag: true, status: "Flagged" },
    { id: "PR-2033", title: "Optimize SQL query execution plans", author: "@caroljdev", repo: "acme/db", score: 4.3, date: "2026-03-05", aiFlag: false, status: "Reviewed" },
    { id: "PR-2041", title: "Add comprehensive error boundary handling", author: "@new_contributor", repo: "acme/ui", score: 2.8, date: "2026-03-04", aiFlag: true, status: "Flagged" },
    { id: "PR-2055", title: "Integrate monitoring dashboard widgets", author: "@dpark", repo: "acme/platform", score: 4.1, date: "2026-03-03", aiFlag: false, status: "Pending" },
];

const payoutState: PayoutState = "Approved";
const signaturesCollected = 3;
const signaturesRequired = 4;

const rankColors = ["text-amber-400", "text-slate-400", "text-orange-400"];
const rankIcons = [Crown, Medal, Award];

/* ───────── Component ───────── */
export default function OrgDashboardPage() {
    const [prFilter, setPrFilter] = useState<"all" | "flagged">("all");
    const filteredPRs = prFilter === "flagged" ? orgPRs.filter((pr) => pr.aiFlag) : orgPRs;

    const payoutStates: PayoutState[] = ["Pending", "Approved", "Released"];
    const payoutIdx = payoutStates.indexOf(payoutState);

    return (
        <div className="min-h-screen pt-28 pb-16 px-4 md:px-8 max-w-[1440px] mx-auto w-full">
            {/* ── Header ── */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black font-heading">Organization Dashboard</h1>
                </div>
                <p className="text-muted-foreground text-lg ml-[52px]">Manage funding pools, review contributor performance, and approve payouts.</p>
            </div>

            {/* ── Org Info Strip ── */}
            <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl font-heading">AC</div>
                    <div>
                        <h2 className="text-xl font-bold font-heading">Acme Corporation</h2>
                        <p className="text-sm text-muted-foreground">Open-source bounty program · 6 active contributors</p>
                    </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>6 Contributors</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <GitPullRequest className="w-4 h-4" />
                        <span>{orgPRs.length} PRs</span>
                    </div>
                </div>
            </div>

            {/* ── Top Row: Funding Pool + Multi-Sig ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Org-Scoped Funding Pool */}
                <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Wallet className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold font-heading">Funding Pool</h2>
                    </div>
                    <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-6 mb-5">
                        <div className="text-sm text-muted-foreground mb-1">Total Bounty Budget</div>
                        <div className="text-4xl font-black font-mono mb-3">500.00 FIL</div>
                        <div className="w-full bg-muted rounded-full h-3 overflow-hidden mb-2">
                            <div className="bg-primary h-full rounded-full transition-all" style={{ width: "62%" }} />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Remaining: <span className="font-semibold text-foreground font-mono">190.00 FIL</span></span>
                            <span className="text-muted-foreground">Distributed: <span className="font-semibold text-foreground font-mono">310.00 FIL</span></span>
                        </div>
                    </div>
                    <div className="bg-muted/30 border border-border rounded-lg p-3 flex items-start gap-2 text-sm text-muted-foreground">
                        <Eye className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>This pool is only visible to contributors participating under Acme Corporation.</span>
                    </div>
                </div>

                {/* Multi-Signature Approval Status */}
                <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <ShieldAlert className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold font-heading">Multi-Signature Approval</h2>
                    </div>

                    {/* Signature collection */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted-foreground">Signatures Collected</span>
                            <span className="text-sm font-bold font-mono">{signaturesCollected} / {signaturesRequired}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {Array.from({ length: signaturesRequired }).map((_, i) => (
                                <div key={i} className={`flex-1 flex items-center justify-center gap-1 p-2.5 rounded-lg border ${i < signaturesCollected ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-400" : "bg-muted/30 border-border text-muted-foreground/40"}`}>
                                    <IconSignature filled={i < signaturesCollected} />
                                    <span className="text-xs font-semibold hidden sm:inline">Sig {i + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Payout state pipeline */}
                    <div className="mb-4">
                        <span className="text-sm text-muted-foreground block mb-3">Payout State</span>
                        <div className="flex items-center gap-2">
                            {payoutStates.map((state, idx) => {
                                const reached = idx <= payoutIdx;
                                const isCurrent = idx === payoutIdx;
                                const icons = [Clock, CheckCircle, Send];
                                const Icon = icons[idx];
                                return (
                                    <React.Fragment key={state}>
                                        <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${reached
                                                ? isCurrent
                                                    ? "bg-primary/15 text-primary border-primary/30 ring-1 ring-primary/30 ring-offset-1 ring-offset-background"
                                                    : "bg-emerald-400/10 text-emerald-400 border-emerald-400/30"
                                                : "bg-muted/30 text-muted-foreground/40 border-transparent"
                                            }`}>
                                            <Icon className="w-3.5 h-3.5" />
                                            {state}
                                        </div>
                                        {idx < payoutStates.length - 1 && (
                                            <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${reached ? "text-muted-foreground" : "text-muted-foreground/20"}`} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-muted/30 border border-border rounded-lg p-3 text-sm text-muted-foreground flex items-start gap-2">
                        <Lock className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                        <span>Awaiting 1 more signature from admin <strong>@charlie_admin</strong> to release funds.</span>
                    </div>
                </div>
            </div>

            {/* ── Contributor Leaderboard ── */}
            <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-2 mb-5">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold font-heading">Contributor Leaderboard</h2>
                </div>
                <div className="space-y-3">
                    {orgContributors.map((c) => {
                        const RankIcon = c.rank <= 3 ? rankIcons[c.rank - 1] : Target;
                        const rankColor = c.rank <= 3 ? rankColors[c.rank - 1] : "text-muted-foreground";
                        return (
                            <div key={c.rank} className="bg-background/60 border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors">
                                <div className={`w-8 h-8 flex items-center justify-center ${rankColor}`}>
                                    <RankIcon className="w-5 h-5" />
                                </div>
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                    {c.avatar}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm">{c.name}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{c.handle}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="flex items-center gap-1 justify-end">
                                        <BarChart3 className="w-3.5 h-3.5 text-primary" />
                                        <span className="font-bold font-mono text-sm">{c.valueScore}</span>
                                        <span className="text-xs text-muted-foreground">/5</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">{c.prs} PRs</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── PR Management Panel + AI Detection ── */}
            <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 mb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2">
                        <GitPullRequest className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold font-heading">PR Management</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPrFilter("all")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${prFilter === "all" ? "bg-primary/10 text-primary border-primary/30" : "bg-muted/30 text-muted-foreground border-border hover:border-primary/20"}`}
                        >
                            All PRs
                        </button>
                        <button
                            onClick={() => setPrFilter("flagged")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 ${prFilter === "flagged" ? "bg-red-500/10 text-red-400 border-red-400/30" : "bg-muted/30 text-muted-foreground border-border hover:border-red-400/20"}`}
                        >
                            <AlertTriangle className="w-3 h-3" />
                            AI Flagged
                        </button>
                    </div>
                </div>

                {/* AI Detection Banner */}
                {prFilter === "flagged" && (
                    <div className="bg-red-500/5 border border-red-400/20 rounded-xl p-4 mb-5 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 text-red-400">
                            <IconAIWarning />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-red-400 mb-0.5">AI-Generated PR Detection</h4>
                            <p className="text-xs text-muted-foreground">The following PRs have been flagged as potentially AI-generated. Review them before the 6-week payout cycle triggers to exclude from scoring.</p>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {filteredPRs.map((pr) => (
                        <div key={pr.id} className={`bg-background/60 border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-primary/30 transition-colors ${pr.aiFlag ? "border-red-400/30" : "border-border"}`}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-xs font-mono text-muted-foreground">{pr.id}</span>
                                    <span className="text-xs text-muted-foreground">{pr.repo}</span>
                                    {pr.aiFlag && (
                                        <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-400/30 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                            <AlertTriangle className="w-3 h-3" />
                                            AI Generated
                                        </span>
                                    )}
                                </div>
                                <h4 className="font-semibold text-sm truncate">{pr.title}</h4>
                                <span className="text-xs text-muted-foreground font-mono">{pr.author}</span>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                                <div className="flex items-center gap-1 text-xs">
                                    <Award className="w-3.5 h-3.5 text-primary" />
                                    <span className="font-bold font-mono">{pr.score}/5</span>
                                </div>
                                <span className="text-xs text-muted-foreground">{pr.date}</span>
                                <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${pr.status === "Reviewed"
                                        ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30"
                                        : pr.status === "Flagged"
                                            ? "bg-red-400/10 text-red-400 border-red-400/30"
                                            : "bg-yellow-400/10 text-yellow-400 border-yellow-400/30"
                                    }`}>
                                    {pr.status}
                                </div>
                                {pr.aiFlag && (
                                    <button className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 border border-red-400/30 rounded-lg px-2.5 py-1.5 hover:bg-red-400/5">
                                        Exclude
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
