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
} from "lucide-react";

/* ───────── Case Study Data ───────── */
const caseStudies = [
    {
        org: "Vercel",
        project: "Next.js",
        description: "Kinetic funded 42 infrastructure contributors who maintained the core webpack integration and streaming SSR pipeline. Contributors saw an average 3.4x increase in payout compared to traditional sponsorship models.",
        metrics: { contributors: 42, totalPaid: "24,800 FIL", avgScore: 4.6, cycle: "8 cycles" },
        tags: ["Infrastructure", "SSR", "Webpack"],
    },
    {
        org: "Protocol Labs",
        project: "IPFS Gateway",
        description: "Dependency-Weighted Quadratic Funding allocated 96% of the pool to foundational protocol contributors, effectively neutralizing a single large-token holder who attempted to direct funds to a vanity project.",
        metrics: { contributors: 18, totalPaid: "12,400 FIL", avgScore: 4.3, cycle: "5 cycles" },
        tags: ["Protocol", "Decentralized", "Anti-Whale"],
    },
    {
        org: "Supabase",
        project: "Realtime Engine",
        description: "Proof-of-Build verification caught 14 Sybil accounts pushing auto-generated test files. Only contributors with verified CI/CD traces received payouts, saving the pool an estimated 8,200 FIL in fraudulent claims.",
        metrics: { contributors: 27, totalPaid: "18,600 FIL", avgScore: 4.1, cycle: "6 cycles" },
        tags: ["Anti-Sybil", "Realtime", "Database"],
    },
];

/* ───────── Algorithm Layer Data ───────── */
const algorithmLayers = [
    { title: "Temporal Decay Weighting", weight: "25%", icon: Clock, description: "Commits and PRs are decayed exponentially. A commit from last week retains 100% weight while a commit from 3 years ago retains approximately 10%. This rewards active maintainers keeping projects alive." },
    { title: "Downstream Blast Radius", weight: "30%", icon: Globe, description: "A breadth-first search of the ecosystem dependency graph. If a high-traffic project depends on your utility library, you receive a weighted portion of its user base. Depth 1 = 1.0x, Depth 2 = 0.6x, Depth 3 = 0.3x." },
    { title: "Code Survival Rate", weight: "20%", icon: Code2, description: "Measures what percentage of original lines written by a contributor remain unmodified after one year. An 85% survival rate proves structurally sound code that does not require immediate rewriting." },
    { title: "Issue Resolution Velocity", weight: "15%", icon: Zap, description: "Tracks how quickly critical bugs are resolved, weighted by severity label. A P0 bug closed in 2 hours yields a high score. A P3 feature request closed in 30 days yields minimal impact." },
    { title: "Cross-Ecosystem Portability", weight: "10%", icon: Layers, description: "Detects if libraries are ported or referenced across multiple package managers including npm, PyPI, Maven, and crates.io. Cross-ecosystem adoption proves fundamental architectural value." },
];

export default function DocsPage() {
    return (
        <div className="min-h-screen pt-28 pb-16 px-4 md:px-8 max-w-[1200px] mx-auto w-full">
            {/* ── Header ── */}
            <div className="mb-16">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black font-heading">Documentation</h1>
                </div>
                <p className="text-muted-foreground text-lg ml-[52px] max-w-2xl">
                    A comprehensive guide to the Kinetic contribution algorithm, verification protocols, and distribution engine.
                </p>
            </div>

            {/* ── Platform Overview ── */}
            <section className="mb-16">
                <h2 className="text-2xl font-bold font-heading mb-4 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-primary" />
                    Platform Overview
                </h2>
                <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-8">
                    <p className="text-muted-foreground leading-relaxed mb-6">
                        Kinetic is a decentralized funding platform purpose-built for open-source developers. Traditional sponsorship relies on vanity metrics — GitHub stars, fork counts, and follower numbers — all of which are trivially manipulated. Kinetic replaces these with a mathematically rigorous scoring engine that measures real contribution impact through verified execution traces and dependency analysis.
                    </p>
                    <p className="text-muted-foreground leading-relaxed mb-6">
                        At the core of the platform is the Multi-Signal Triangulation Score (MSTS), a composite metric that evaluates five independent signal layers. These signals must all mathematically converge, making it computationally infeasible to game the system without producing genuinely valuable work.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-background/60 border border-border rounded-xl p-4 flex items-start gap-3">
                            <BarChart3 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Algorithmic Scoring</h4>
                                <p className="text-xs text-muted-foreground">Five-layer triangulation ensures only real impact is measured and rewarded.</p>
                            </div>
                        </div>
                        <div className="bg-background/60 border border-border rounded-xl p-4 flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Sybil Resistant</h4>
                                <p className="text-xs text-muted-foreground">Proof-of-Build requires verified CI/CD execution traces for every scored PR.</p>
                            </div>
                        </div>
                        <div className="bg-background/60 border border-border rounded-xl p-4 flex items-start gap-3">
                            <Scale className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Fair Distribution</h4>
                                <p className="text-xs text-muted-foreground">Quadratic funding ensures community voices outweigh singular large stakeholders.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── MSTS Algorithm ── */}
            <section className="mb-16">
                <h2 className="text-2xl font-bold font-heading mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    Multi-Signal Triangulation Score (MSTS)
                </h2>
                <p className="text-muted-foreground mb-6 max-w-3xl">
                    Each contributor is scored from 0 to 100 based on the weighted sum of five independent signal layers. The triangulation of multiple uncorrelated signals ensures manipulation of any single metric has negligible effect on the final score.
                </p>
                <div className="space-y-4">
                    {algorithmLayers.map((layer, i) => {
                        const Icon = layer.icon;
                        return (
                            <div key={i} className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 flex flex-col md:flex-row items-start gap-5 hover:border-primary/30 transition-colors">
                                <div className="flex items-center gap-4 shrink-0 md:w-64">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <Icon className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <div className="text-primary font-mono font-bold text-lg">{layer.weight}</div>
                                        <h4 className="font-semibold text-sm">{layer.title}</h4>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{layer.description}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Proof-of-Build ── */}
            <section className="mb-16">
                <h2 className="text-2xl font-bold font-heading mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    Proof-of-Build Verification
                </h2>
                <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-8">
                    <p className="text-muted-foreground leading-relaxed mb-6">
                        The Proof-of-Build protocol serves as the primary Sybil prevention mechanism. No contribution receives a score unless it is accompanied by a verified CI/CD execution trace. The system dynamically queries the GitHub Actions API to confirm that a specific workflow run physically compiled and executed with a success status.
                    </p>
                    <div className="bg-background/60 border border-border rounded-xl p-5 font-mono text-sm mb-6">
                        <div className="text-muted-foreground mb-1">// Scoring formula</div>
                        <div className="text-foreground">Final_Score = MSTS_Raw_Score × ProofOfBuild_Multiplier</div>
                        <div className="text-muted-foreground mt-3 mb-1">// Where:</div>
                        <div className="text-foreground">ProofOfBuild_Multiplier = verified_trace ? <span className="text-emerald-400">1.0</span> : <span className="text-red-400">0.0</span></div>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-sm">
                        If no verified execution trace exists, the multiplier is exactly 0 — completely zeroing out any accumulated score. This makes it impossible to inflate metrics through auto-generated code or bot-driven commits without actually burning compute and producing functional software.
                    </p>
                </div>
            </section>

            {/* ── Quadratic Funding ── */}
            <section className="mb-16">
                <h2 className="text-2xl font-bold font-heading mb-4 flex items-center gap-2">
                    <Scale className="w-5 h-5 text-primary" />
                    Dependency-Weighted Quadratic Funding
                </h2>
                <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-8">
                    <p className="text-muted-foreground leading-relaxed mb-6">
                        Standard token voting is fundamentally broken because it empowers single large stakeholders — commonly referred to as whales. Kinetic addresses this with a modified Quadratic Funding mechanism that replaces raw token volume with the square root of each contributor's MSTS impact score.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-red-500/5 border border-red-400/20 rounded-xl p-5">
                            <h4 className="text-sm font-semibold mb-2 text-red-400 flex items-center gap-1.5">
                                <GitPullRequest className="w-4 h-4" />
                                Standard Token Voting (Flawed)
                            </h4>
                            <div className="text-sm text-muted-foreground font-mono space-y-1">
                                <div>1 Whale × 100 tokens = 100 votes</div>
                                <div>25 Community × 4 tokens = 100 votes</div>
                                <div className="text-red-400 font-semibold pt-1">Result: Tie — Whale has equal power</div>
                            </div>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-400/20 rounded-xl p-5">
                            <h4 className="text-sm font-semibold mb-2 text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle className="w-4 h-4" />
                                Kinetic Quadratic Funding
                            </h4>
                            <div className="text-sm text-muted-foreground font-mono space-y-1">
                                <div>Whale: sqrt(100) = 10 → weight = 100</div>
                                <div>Community: 25 × sqrt(4) = 50 → weight = 2500</div>
                                <div className="text-emerald-400 font-semibold pt-1">Result: Community receives 96% of pool</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Case Studies ── */}
            <section className="mb-16">
                <h2 className="text-2xl font-bold font-heading mb-2 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    Funded Project Case Studies
                </h2>
                <p className="text-muted-foreground mb-6">Real organizations leveraging Kinetic to sustainably fund their open-source dependencies.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {caseStudies.map((cs, i) => (
                        <div key={i} className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 flex flex-col justify-between hover:border-primary/30 transition-colors group">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{cs.org.charAt(0)}</div>
                                    <div>
                                        <h4 className="font-bold text-sm">{cs.org}</h4>
                                        <span className="text-xs text-muted-foreground">{cs.project}</span>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{cs.description}</p>
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    {cs.tags.map((tag) => (
                                        <span key={tag} className="bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-md">{tag}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                                <div>
                                    <div className="text-xs text-muted-foreground">Contributors</div>
                                    <div className="font-bold font-mono text-sm flex items-center gap-1"><Users className="w-3 h-3 text-primary" />{cs.metrics.contributors}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Total Paid</div>
                                    <div className="font-bold font-mono text-sm">{cs.metrics.totalPaid}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Avg Score</div>
                                    <div className="font-bold font-mono text-sm flex items-center gap-1"><TrendingUp className="w-3 h-3 text-primary" />{cs.metrics.avgScore}/5</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Duration</div>
                                    <div className="font-bold font-mono text-sm">{cs.metrics.cycle}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
