"use client";
import React, { useState } from "react";
import {
    Building2,
    Wallet,
    Users,
    GitPullRequest,
    ShieldCheck,
    CheckCircle,
    Clock,
    ArrowRight,
    ExternalLink,
    Award,
    TrendingUp,
    BarChart3,
    Eye,
    Search,
    Download,
    Lock,
    Unlock,
    Activity,
    Database,
    FileSearch,
    ShieldAlert,
    RefreshCcw,
    Zap
} from "lucide-react";

/* ───────── Mock Data & Types ───────── */
type TxStatus = "pending" | "finalized" | "sealed";

interface PayoutRequest {
    id: string;
    contributor: string;
    score: number;
    amount: number;
    status: "pending" | "approved";
}

const mockPayouts: PayoutRequest[] = [
    { id: "PX-001", contributor: "alicedev.flow", score: 94, amount: 450, status: "pending" },
    { id: "PX-002", contributor: "bobcodes.flow", score: 88, amount: 320, status: "pending" },
    { id: "PX-003", contributor: "charlie.flow", score: 91, amount: 380, status: "pending" },
];

const txStatus: TxStatus = "finalized";

/* ───────── Sub-components ───────── */

const StatusBadge = ({ status }: { status: TxStatus }) => {
    const configs = {
        pending: { color: "text-yellow-400", bg: "bg-yellow-400/10", label: "Pending" },
        finalized: { color: "text-blue-400", bg: "bg-blue-400/10", label: "Finalized" },
        sealed: { color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Sealed" }
    };
    const cfg = configs[status];
    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color} border border-current/20`}>
            {cfg.label}
        </span>
    );
};

export default function OrgDashboardPage() {
    const [signatures, setSignatures] = useState([true, true, false]);

    return (
        <div className="min-h-screen pt-28 pb-16 px-4 md:px-8 max-w-[1600px] mx-auto w-full font-sans">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-glow-sm">
                            <Building2 className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Organization Core</h1>
                    </div>
                    <p className="text-muted-foreground text-lg ml-1">Protocol Labs · Governance & Funding Terminal</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-card border border-border rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm font-medium text-muted-foreground">Flow Mainnet Connected</span>
                    </div>
                    <button className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-glow-sm">
                        <Zap className="w-4 h-4 fill-current" />
                        Execute Payouts
                    </button>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:border-primary/30 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Bounty Pool</span>
                        <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <Wallet className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-3xl font-black font-mono">14,250 FLOW</div>
                    <div className="text-sm text-emerald-500 font-medium mt-1 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        +$12,042.00 USD
                    </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:border-primary/30 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Contributors</span>
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-3xl font-black font-mono">124</div>
                    <div className="text-sm text-muted-foreground mt-1 font-medium italic">Across 18 repositories</div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:border-primary/30 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Network Score</span>
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-3xl font-black font-mono">82.4/100</div>
                    <div className="text-sm text-muted-foreground mt-1 font-medium">+4.2 from last cycle</div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:border-primary/30 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cycle Progress</span>
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-3xl font-black font-mono">WEEK 4/6</div>
                    <div className="w-full bg-muted rounded-full h-2 mt-4 overflow-hidden">
                        <div className="bg-amber-500 h-full w-[66%] transition-all" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Payout Management */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Payout Table Preview */}
                    <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-primary" />
                                <h2 className="text-xl font-bold font-heading">Algorithm Payout Preview</h2>
                            </div>
                            <button className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg bg-background">
                                <Download className="w-3.5 h-3.5" />
                                Export CSV
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        <th className="px-6 py-4">ID</th>
                                        <th className="px-6 py-4">Contributor</th>
                                        <th className="px-6 py-4">MSTS Score</th>
                                        <th className="px-6 py-4">Bounty Share</th>
                                        <th className="px-6 py-4">Audit Trace</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {mockPayouts.map((p) => (
                                        <tr key={p.id} className="hover:bg-muted/10 transition-colors group">
                                            <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{p.id}</td>
                                            <td className="px-6 py-4 font-bold text-sm">{p.contributor}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
                                                        <div className="bg-primary h-full" style={{ width: `${p.score}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold font-mono">{p.score}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono font-bold text-emerald-500">{p.amount} FLOW</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer font-mono opacity-60 group-hover:opacity-100">
                                                    <FileSearch className="w-3.5 h-3.5" />
                                                    bafy...3821
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <button className="text-xs font-bold px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                                                    View Proof
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Transaction Activity Feed */}
                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Activity className="w-5 h-5 text-primary" />
                                <h2 className="text-xl font-bold font-heading">Real-time Chain Status</h2>
                            </div>
                            <div className="flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 rounded-xl border border-border">
                                <RefreshCcw className="w-3.5 h-3.5 text-muted-foreground animate-spin-slow" />
                                <span className="text-xs font-bold text-muted-foreground">Auto-refresh active</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {[
                                { tx: "0x892...2841", label: "Pool Distribution", time: "2m ago", state: "sealed" },
                                { tx: "0x124...9012", label: "Deposit FLOW (Org)", time: "15m ago", state: "sealed" },
                                { tx: "0x7a3...e421", label: "MSTS Score Calculation", time: "34m ago", state: "finalized" },
                                { tx: "0xbb8...3821", label: "Multi-sig Submission", time: "1h ago", state: "finalized" },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl hover:border-primary/20 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-xl border border-current/20 ${item.state === 'sealed' ? 'text-emerald-500 bg-emerald-500/10' : 'text-blue-500 bg-blue-500/10'}`}>
                                            <ShieldCheck className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold flex items-center gap-2">
                                                {item.label}
                                                <StatusBadge status={item.state as TxStatus} />
                                            </div>
                                            <div className="text-xs font-mono text-muted-foreground mt-1 select-all">{item.tx}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-muted-foreground font-medium">{item.time}</div>
                                        <ExternalLink className="w-3.5 h-3.5 text-primary mt-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Governance & Leaderboard */}
                <div className="space-y-8">
                    {/* Multi-Sig Panel */}
                    <div className="bg-[#111] text-white border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-6">
                                <ShieldAlert className="w-5 h-5 text-primary" />
                                <h2 className="text-xl font-bold font-heading">Multi-Signature Approval</h2>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-bold text-white/40 uppercase tracking-widest text-[10px]">Authorizations Collected</span>
                                        <span className="text-sm font-black font-mono">2 / 3</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {signatures.map((signed, i) => (
                                            <div
                                                key={i}
                                                className={`flex-1 h-12 rounded-xl border flex items-center justify-center transition-all ${signed ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-white/20'}`}
                                            >
                                                {signed ? <CheckCircle className="w-5 h-5" /> : <Lock className="w-5 h-5 opacity-20" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-white/60 mb-6 leading-relaxed">
                                Funds will undergo autonomous smart contract execution once <span className="text-primary font-bold underline decoration-primary/30 underline-offset-4">admin_charlie</span> seals the final signature.
                            </p>

                            <button className="w-full bg-white text-black font-black py-4 rounded-2xl hover:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                                Review & Sign Proposed Payouts
                            </button>
                        </div>
                    </div>

                    {/* Contributor Leaderboard */}
                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Award className="w-5 h-5 text-primary" />
                                <h2 className="text-lg font-bold font-heading">Leaderboard</h2>
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted/50 px-2 py-1 rounded-md">W4 Cycle 5</span>
                        </div>
                        <div className="space-y-5">
                            {[
                                { name: "@alicedev", score: 94.8, avatar: "A" },
                                { name: "@bobcodes", score: 88.2, avatar: "B" },
                                { name: "@daviddias", score: 86.5, avatar: "D" },
                                { name: "@stebien", score: 82.1, avatar: "S" },
                            ].map((user, i) => (
                                <div key={i} className="flex items-center justify-between group cursor-pointer hover:bg-muted/30 p-2 rounded-2xl transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                                            {user.avatar}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold group-hover:text-primary transition-colors">{user.name}</div>
                                            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Contributor</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black font-mono">{user.score}</div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold">MSTS pts</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Audit Viewer (CID links) */}
                    <div className="bg-muted/20 border border-border rounded-3xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Database className="w-4 h-4 text-muted-foreground" />
                            <h3 className="text-sm font-bold opacity-80 uppercase tracking-widest text-[10px]">IPFS/Filecoin Audit Archive</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="p-3 bg-background border border-border rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileSearch className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="text-xs font-mono truncate text-muted-foreground">bafybeig...q6ma</span>
                                </div>
                                <Search className="w-3 h-3 text-muted-foreground shrink-0" />
                            </div>
                            <div className="p-3 bg-background border border-border rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileSearch className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="text-xs font-mono truncate text-muted-foreground">bafybeid...7z4y</span>
                                </div>
                                <Search className="w-3 h-3 text-muted-foreground shrink-0" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
