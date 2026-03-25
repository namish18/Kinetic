"use client";
import React from "react";
import {
    BookOpen,
    Layers,
    ShieldCheck,
    Scale,
    GitPullRequest,
    BarChart3,
    Clock,
    Globe,
    Code2,
    Terminal,
    ArrowRight,
    ExternalLink,
    CheckCircle,
    Zap,
    Building2,
    Users,
    TrendingUp,
    Activity,
    FileText,
    Target
} from "lucide-react";

/* ───────── Case Study Data ───────── */
const caseStudies = [
    {
        org: "Protocol Labs",
        project: "libp2p",
        description: "Kinetic funded 42 infrastructure contributors who maintained the core gossipsub implementation. Contributors saw an average 3.4x increase in payout compared to traditional models.",
        metrics: { contributors: 42, totalPaid: "24,800 FLOW", avgScore: 4.6, cycle: "8 cycles" },
        tags: ["Infrastructure", "P2P", "Gossipsub"],
    },
    {
        org: "Ecosystem Hub",
        project: "IPFS Integration",
        description: "Quadratic Funding allocated 96% of the pool to core protocol contributors, effectively neutralizing singular large-token holders who attempted to direct funds to vanity projects.",
        metrics: { contributors: 18, totalPaid: "12,400 FLOW", avgScore: 4.3, cycle: "5 cycles" },
        tags: ["Protocol", "Decentralized", "Anti-Whale"],
    },
    {
        org: "Node Forge",
        project: "Realtime Engine",
        description: "Proof-of-Build verification caught 14 Sybil accounts pushing auto-generated test files. Only contributors with verified CI/CD traces received payouts.",
        metrics: { contributors: 27, totalPaid: "18,600 FLOW", avgScore: 4.1, cycle: "6 cycles" },
        tags: ["Anti-Sybil", "Realtime", "Database"],
    },
];

/* ───────── Algorithm Layer Data ───────── */
const algorithmLayers = [
    { title: "Task Complexity", weight: "20%", icon: Zap, description: "Log-scaled complexity factor calculated from additions, deletions, and changed files. Rewards architectural depth over raw character volume." },
    { title: "Impact Dimension", weight: "20%", icon: Target, description: "Measures the blast radius of the PR by analyzing commit frequency and file diversity. Prevents credit for isolated micro-changes." },
    { title: "Code Quality", weight: "20%", icon: Code2, description: "Analyzes refactor ratios and deletion-to-addition density. Proves code was structurally sound and simplified the codebase." },
    { title: "Review Friction", weight: "20%", icon: Activity, description: "Tracks review cycles, requested changes, and comment density. Deep collaborative friction is a proxy for high engineering leverage." },
    { title: "Execution Priority", weight: "20%", icon: FileText, description: "Repository-specific priority weights assigned by organizations to reflect the strategic urgency of specific components or features." },
];

export default function DocsPage() {
    return (
        <div className="min-h-screen pt-28 pb-16 px-4 md:px-8 max-w-[1200px] mx-auto w-full font-sans">
            {/* ── Header ── */}
            <div className="mb-16">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-glow-sm">
                        <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight">Technical Spec</h1>
                </div>
                <p className="text-muted-foreground text-lg ml-1 font-medium max-w-2xl italic">
                    A comprehensive guide to the Kinetic Valuation Algorithm and Proof-of-Build protocols.
                </p>
            </div>

            {/* ── Platform Overview ── */}
            <section className="mb-16">
                <h2 className="text-2xl font-black tracking-tight mb-4 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-primary" />
                    Platform Philosophy
                </h2>
                <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
                    <p className="text-muted-foreground leading-relaxed mb-6 font-medium">
                        Kinetic is an autonomous funding protocol that prices software artifacts algorithmically. Traditional sponsorship relies on vanity metrics — GitHub stars and fork counts — all of which are trivially manipulated. Kinetic replaces these with a mathematically rigorous scoring engine that measures real contribution impact through verified execution traces.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-muted/30 border border-border rounded-2xl p-6 hover:border-primary/30 transition-all group">
                            <BarChart3 className="w-6 h-6 text-primary mb-4 group-hover:scale-110 transition-transform" />
                            <h4 className="text-sm font-black uppercase tracking-widest mb-2">Algorithmic Valuation</h4>
                            <p className="text-xs text-muted-foreground font-medium">Multi-dimensional triangulation ensures only high-leverage work is rewarded.</p>
                        </div>
                        <div className="bg-muted/30 border border-border rounded-2xl p-6 hover:border-primary/30 transition-all group">
                            <ShieldCheck className="w-6 h-6 text-primary mb-4 group-hover:scale-110 transition-transform" />
                            <h4 className="text-sm font-black uppercase tracking-widest mb-2">Sybil Resistant</h4>
                            <p className="text-xs text-muted-foreground font-medium">Proof-of-Build requires successful CI/CD execution traces for every scored PR.</p>
                        </div>
                        <div className="bg-muted/30 border border-border rounded-2xl p-6 hover:border-primary/30 transition-all group">
                            <Scale className="w-6 h-6 text-primary mb-4 group-hover:scale-110 transition-transform" />
                            <h4 className="text-sm font-black uppercase tracking-widest mb-2">Reputation Scaled</h4>
                            <p className="text-xs text-muted-foreground font-medium">Historical performance and network reputation act as score multipliers.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Valuation Algorithm ── */}
            <section className="mb-16">
                <h2 className="text-2xl font-black tracking-tight mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    Valuation Algorithm (VA)
                </h2>
                <p className="text-muted-foreground mb-8 max-w-3xl font-medium">
                    Each contributor is priced based on the weighted sum of five independent signal layers. This triangulation makes it computationally infeasible to game the system without producing genuinely valuable work.
                </p>
                <div className="space-y-4">
                    {algorithmLayers.map((layer, i) => {
                        const Icon = layer.icon;
                        return (
                            <div key={i} className="bg-card border border-border rounded-3xl p-6 flex flex-col md:flex-row items-start gap-6 hover:border-primary/30 transition-all hover:bg-muted/5 group">
                                <div className="flex items-center gap-4 shrink-0 md:w-64">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="text-primary font-mono font-black text-xl">{layer.weight}</div>
                                        <h4 className="font-black text-xs uppercase tracking-widest">{layer.title}</h4>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed flex-1 font-medium">{layer.description}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Proof-of-Build ── */}
            <section className="mb-16">
                <h2 className="text-2xl font-black tracking-tight mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    Proof-of-Build Verification
                </h2>
                <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
                    <p className="text-muted-foreground leading-relaxed mb-8 font-medium">
                        The Proof-of-Build protocol serves as the primary anti-spam mechanism. No contribution receives a score unless it is accompanied by a verified CI/CD execution trace. The system dynamically queries GitHub APIs to confirm that a specific workflow run physically compiled and executed with a success status.
                    </p>
                    <div className="bg-[#050505] border border-white/10 rounded-2xl p-6 font-mono text-sm mb-6 text-white/50 shadow-2xl">
                        <div className="mb-1 italic opacity-40">// Pricing formula</div>
                        <div className="text-white font-bold"><span className="text-primary">Final_Score</span> = (Base_Score * Rep_Multiplier * DAO_Adj)</div>
                        <div className="mt-4 mb-1 italic opacity-40">// Sybil Check:</div>
                        <div className="text-white">IF (!verified_ci_trace) <span className="text-primary">Gate_Score</span> = <span className="text-red-500">0</span>;</div>
                    </div>
                </div>
            </section>

            {/* ── Case Studies ── */}
            <section className="mb-16">
                <h2 className="text-2xl font-black tracking-tight mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    Runtime Case Studies
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {caseStudies.map((cs, i) => (
                        <div key={i} className="bg-card border border-border rounded-[2rem] p-6 flex flex-col justify-between hover:border-primary/30 transition-all shadow-sm group">
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-foreground font-black border border-border">{cs.org.charAt(0)}</div>
                                    <div>
                                        <h4 className="font-black text-sm tracking-tight">{cs.org}</h4>
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{cs.project}</span>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-medium italic">"{cs.description}"</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border">
                                <div>
                                    <div className="text-[9px] font-black text-muted-foreground uppercase mb-1">Total Rewards</div>
                                    <div className="font-black font-mono text-xs text-emerald-500">{cs.metrics.totalPaid}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-muted-foreground uppercase mb-1">Impact Avg</div>
                                    <div className="font-black font-mono text-xs">{cs.metrics.avgScore}/5</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
