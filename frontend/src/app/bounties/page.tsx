"use client";
import React, { useState, useEffect } from "react";
import { 
    Award, 
    Search, 
    Filter, 
    Github, 
    ExternalLink, 
    Activity, 
    Zap,
    Building2,
    RefreshCcw
} from "lucide-react";

/* ───────── Flow Icon ───────── */
const IconFlow = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
    <path d="M10 2L2 10l8 8 8-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 6l-4 4 4 4 4-4-4-4z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1" />
  </svg>
);

interface RepoBounty {
    name: string;
    owner: string;
    ownerAvatar?: string;
    totalPool: number;
    activePRs: number;
    weights: {
        impact: number;
        complexity: number;
        quality: number;
        review: number;
        priority: number;
    };
}

export default function BountiesPage() {
    const [search, setSearch] = useState("");
    const [bounties, setBounties] = useState<RepoBounty[]>([]);
    const [loading, setLoading] = useState(true);

    const loadBounties = async () => {
        setLoading(true);
        try {
            const res = await fetch("http://localhost:5000/api/org/all");
            const data = await res.json();
            if (data.success) {
                setBounties(data.repositories);
            }
        } catch (e) {
            console.error("Failed to fetch bounties:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBounties();
    }, []);

    const filteredBounties = bounties.filter(b => 
        b.name.toLowerCase().includes(search.toLowerCase()) || 
        b.owner.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen pt-28 pb-16 px-4 md:px-8 max-w-[1440px] mx-auto w-full font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-glow-sm">
                            <Award className="w-6 h-6 text-emerald-500" />
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tight">Ecosystem Bounties</h1>
                    </div>
                    <p className="text-muted-foreground text-lg ml-1 font-medium italic">Verified repository pools scaled by valuation weights.</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <button 
                        onClick={loadBounties}
                        className="p-3 rounded-2xl bg-secondary hover:bg-secondary/80 transition-all"
                    >
                        <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
                        <div className="text-right">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-0.5">Active Tasks</span>
                            <span className="text-2xl font-black font-mono">{bounties.length}+</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="flex flex-col md:flex-row gap-4 mb-10">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Search repositories or owners..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-card border border-border rounded-2xl pl-12 pr-6 py-4 text-sm font-medium focus:outline-none focus:border-primary/50 transition-all shadow-sm"
                    />
                </div>
            </div>

            {loading && bounties.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <p className="font-bold text-muted-foreground">Indexing verified repositories...</p>
                </div>
            ) : filteredBounties.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 border border-dashed border-border rounded-[2.5rem]">
                    <p className="text-xl font-bold text-muted-foreground">No bounties matching your search.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {filteredBounties.map((b, i) => (
                        <div key={i} className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm hover:border-primary/30 transition-all group relative overflow-hidden flex flex-col">
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center border border-border font-bold text-xl overflow-hidden">
                                        {b.ownerAvatar ? (
                                            <img src={b.ownerAvatar} alt={b.owner} className="w-full h-full object-cover" />
                                        ) : (
                                            b.owner.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-primary font-mono opacity-70">@{b.owner}</span>
                                            <div className="w-1 h-1 rounded-full bg-border" />
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{b.activePRs} Active PRs</span>
                                        </div>
                                        <h3 className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors flex items-center gap-2">
                                            {b.name}
                                            <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity" />
                                        </h3>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">Estimated Pot</span>
                                    <div className="flex items-center justify-end gap-1.5 text-emerald-500 font-mono">
                                        <IconFlow />
                                        <span className="text-2xl font-black">{b.totalPool}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 space-y-6 mb-10">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                            <Activity className="w-3.5 h-3.5" />
                                            Valuation Algorithm Weights
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2 h-16 items-end">
                                        {Object.entries(b.weights).map(([k, v], i) => (
                                            <div key={k} className="relative group/bar flex flex-col items-center">
                                                <div 
                                                    className="w-full bg-primary/20 rounded-lg group-hover/bar:bg-primary transition-all duration-300" 
                                                    style={{ height: `${v * 200}%` }}
                                                />
                                                <span className="mt-2 text-[8px] font-black text-muted-foreground uppercase tracking-tighter text-center leading-none">
                                                    {k.substring(0, 4)}<br/>{Math.round(v * 100)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto flex items-center justify-between pt-8 border-t border-border">
                                <a 
                                    href={`https://github.com/${b.name}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="bg-foreground text-background font-black px-6 py-3 rounded-2xl text-xs flex items-center gap-2 hover:scale-[1.02] transition-all"
                                >
                                    <Github className="w-4 h-4" />
                                    Review Repository
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Banner */}
            <div className="mt-16 p-10 bg-[#050505] text-white border border-white/10 rounded-[2.5rem] relative overflow-hidden">
                <div className="relative z-10">
                    <div className="inline-flex items-center space-x-2 bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-black mb-4 tracking-widest border border-primary/20 uppercase">
                        <Zap className="w-3 h-3 fill-current" />
                        Autonomous Pricing Protocol
                    </div>
                    <h2 className="text-3xl font-black tracking-tight mb-4">Code is <span className="text-primary italic font-serif">Valued</span> Algorithmically.</h2>
                    <p className="text-white/60 text-lg max-w-2xl font-medium">
                        Kinetic eliminates manual bounty pricing. The Valuation Algorithm (VA) automatically prices your contributions based on log-scaled complexity, verified impact, and reputation weights defined by the ecosystem.
                    </p>
                </div>
            </div>
        </div>
    );
}
