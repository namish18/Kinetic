"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
    Building2,
    Wallet,
    Users,
    GitPullRequest,
    ShieldCheck,
    CheckCircle,
    ArrowRight,
    ExternalLink,
    Award,
    TrendingUp,
    BarChart3,
    Download,
    Lock,
    Activity,
    Database,
    FileSearch,
    ShieldAlert,
    RefreshCcw,
    Zap,
    Loader2,
    Github,
    LogOut,
    SlidersHorizontal,
    GitBranch,
    X,
    AlertCircle,
    Check,
} from "lucide-react";

/* ───────── Types ───────── */
type TxStatus = "pending" | "finalized" | "sealed";

interface RecentEvent {
    username: string;
    type: string;
    repo: string;
    score: number;
    timestamp: string;
    cid: string;
}

interface ContributorInfo {
    username: string;
    totalScore: number;
    prCount: number;
    avatar: string;
}

interface RepoConfig {
    name: string;
    targetBranches: string[];
    weights: {
        impact: number;
        complexity: number;
        quality: number;
        review: number;
        priority: number;
    };
    bountyPool: number;
}

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

type WeightKey = "impact" | "complexity" | "quality" | "review" | "priority";
const WEIGHT_KEYS: WeightKey[] = ["impact", "complexity", "quality", "review", "priority"];

export default function OrgDashboardPage() {
    const [token, setToken] = useState("");
    const [repos, setRepos] = useState<RepoConfig[]>([]);
    const [contributors, setContributors] = useState<ContributorInfo[]>([]);
    const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [newRepo, setNewRepo] = useState("");
    const [signatures, setSignatures] = useState([true, true, false]);
    const [isExecutingPayout, setIsExecutingPayout] = useState(false);

    // ── Unified Repo Edit Modal ──
    const [editModal, setEditModal] = useState<{
        open: boolean;
        repoName: string;
        weights: Record<WeightKey, number>;
        targetBranches: string[];
        bountyPool: number;
        availableBranches: string[];
        loadingBranches: boolean;
        error: string;
    }>({
        open: false,
        repoName: "",
        weights: { impact: 0.2, complexity: 0.2, quality: 0.2, review: 0.2, priority: 0.2 },
        targetBranches: [],
        bountyPool: 100,
        availableBranches: [],
        loadingBranches: false,
        error: ""
    });

    const FLOW_TO_USD = 0.02874;

    const formatUSD = (flow: number) => {
        return (flow * FLOW_TO_USD).toLocaleString("en-US", { style: "currency", currency: "USD" });
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        window.location.href = "/login";
    };

    const fetchData = async (authToken: string) => {
        setLoading(true);
        try {
            // Repos
            const repoRes = await fetch("http://localhost:5000/api/org/info", {
                headers: { "Authorization": `Bearer ${authToken}` }
            });
            const rData = await repoRes.json();
            if (rData.success) setRepos(Array.isArray(rData.repositories) ? rData.repositories : []);

            // Contributors & Events (Real Algorithm Results)
            const contRes = await fetch("http://localhost:5000/api/org/contributors", {
                headers: { "Authorization": `Bearer ${authToken}` }
            });
            const cData = await contRes.json();
            if (cData.success) {
                setContributors(Array.isArray(cData.contributors) ? cData.contributors : []);
                setRecentEvents(Array.isArray(cData.recentEvents) ? cData.recentEvents : []);
            }

        } catch (e) {
            console.error(e);
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
            // Securely clear token from address bar
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const addRepo = async () => {
        if (!newRepo) return;
        try {
            const res = await fetch("http://localhost:5000/api/org/repositories", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ repository: newRepo })
            });
            const data = await res.json();
            if (data.success) {
                setRepos(Array.isArray(data.repositories) ? data.repositories : []);
                setNewRepo("");
            }
        } catch (e) { console.error(e); }
    };

    const handleExecutePayout = async () => {
        setIsExecutingPayout(true);
        try {
            const res = await fetch("http://localhost:5000/api/org/payout/execute", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                alert(`Successfully executed payouts on Flow network for ${data.results.length} contributors!`);
            } else {
                alert("Execution failed: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Execution failed due to network error.");
        } finally {
            setIsExecutingPayout(false);
        }
    };

    // ── Unified Modal Handlers ─────────────────────────────────────
    const openEditModal = async (r: RepoConfig) => {
        setEditModal({
            open: true,
            repoName: r.name,
            weights: { ...r.weights },
            targetBranches: [...(r.targetBranches || [])],
            bountyPool: r.bountyPool || 100,
            availableBranches: [],
            loadingBranches: true,
            error: ""
        });

        try {
            const res = await fetch(
                `http://localhost:5000/api/org/repositories/${encodeURIComponent(r.name)}/branches`,
                { headers: { "Authorization": `Bearer ${token}` } }
            );
            const data = await res.json();
            if (data.success) {
                setEditModal(prev => ({ ...prev, availableBranches: data.branches, loadingBranches: false }));
            } else {
                setEditModal(prev => ({ ...prev, loadingBranches: false, error: data.error || "Failed to fetch branches" }));
            }
        } catch (e) {
            setEditModal(prev => ({ ...prev, loadingBranches: false, error: "Network error fetching branches" }));
        }
    };

    const toggleBranch = (branch: string) => {
        setEditModal(prev => ({
            ...prev,
            targetBranches: prev.targetBranches.includes(branch)
                ? prev.targetBranches.filter(b => b !== branch)
                : [...prev.targetBranches, branch]
        }));
    };

    const saveRepoConfig = async () => {
        const sum = Object.values(editModal.weights).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1) > 0.001) return;
        
        try {
            const res = await fetch(
                `http://localhost:5000/api/org/repositories/${encodeURIComponent(editModal.repoName)}/config`,
                { 
                    method: "PUT", 
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({
                        weights: editModal.weights,
                        targetBranches: editModal.targetBranches,
                        bountyPool: editModal.bountyPool
                    }) 
                }
            );
            const data = await res.json();
            if (data.success) {
                setRepos(Array.isArray(data.repositories) ? data.repositories : []);
                setEditModal(prev => ({ ...prev, open: false }));
            }
        } catch (e) { console.error(e); }
    };

    if (loading && repos.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    const safeContributors = Array.isArray(contributors) ? contributors : [];
    const safeRecentEvents = Array.isArray(recentEvents) ? recentEvents : [];
    const totalScoreAvg = safeContributors.length > 0 ? (safeContributors.reduce((acc, c) => acc + c.totalScore, 0) / safeContributors.length).toFixed(1) : "0";
    const totalAllocatedPool = repos.reduce((acc, r) => acc + (r.bountyPool || 100), 0);
    const totalPayout = safeContributors.reduce((acc, c) => acc + (c.totalScore * 5), 0);

    /* ── Weight sum for live validation ── */
    const weightSum = Object.values(editModal.weights).reduce((a, b) => a + b, 0);
    const weightSumOk = Math.abs(weightSum - 1) <= 0.001;

    return (
      <>
        {/* ══════════════ Unified Repo Edit Modal ══════════════ */}
        {editModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setEditModal(p => ({ ...p, open: false }))}>
                <div className="bg-card border border-border rounded-[2.5rem] p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                <SlidersHorizontal className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black tracking-tight">Edit Repo Config</h2>
                                <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">{editModal.repoName}</p>
                            </div>
                        </div>
                        <button onClick={() => setEditModal(p => ({ ...p, open: false }))} className="p-3 rounded-2xl hover:bg-muted transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                        {/* Section 1: Branches & Bounty */}
                        <div className="space-y-8">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <GitBranch className="w-4 h-4 text-primary" />
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Target Branches</h3>
                                </div>
                                {editModal.loadingBranches ? (
                                    <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                        Fetching branches...
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                                        {(editModal.availableBranches.length > 0 ? editModal.availableBranches : editModal.targetBranches).map(branch => {
                                            const selected = editModal.targetBranches.includes(branch);
                                            return (
                                                <button
                                                    key={branch}
                                                    onClick={() => toggleBranch(branch)}
                                                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border font-mono text-xs font-bold transition-all ${selected ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-background border-border text-foreground hover:border-primary/30'}`}
                                                >
                                                    {branch}
                                                    {selected && <Check className="w-3.5 h-3.5" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <Wallet className="w-4 h-4 text-primary" />
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Bounty Pool (FLOW)</h3>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={editModal.bountyPool}
                                        onChange={e => setEditModal(prev => ({ ...prev, bountyPool: parseFloat(e.target.value) || 0 }))}
                                        className="w-full bg-background border border-border rounded-2xl px-5 py-4 text-xl font-mono font-black focus:outline-none focus:border-primary/50 transition-all"
                                    />
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground bg-muted/30 px-3 py-1 rounded-lg border border-border">
                                        FLOW
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-2 font-mono uppercase tracking-widest px-1">
                                    Equivalent to ~{formatUSD(editModal.bountyPool)} USD
                                </p>
                            </div>
                        </div>

                        {/* Section 2: Algo Weights */}
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <Zap className="w-4 h-4 text-primary" />
                                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Algo Weights</h3>
                            </div>
                            <div className="space-y-4">
                                {WEIGHT_KEYS.map(key => (
                                    <div key={key} className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest capitalize">{key}</label>
                                            <span className="text-[10px] font-black font-mono">{editModal.weights[key].toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range" min="0" max="1" step="0.01"
                                                value={editModal.weights[key]}
                                                onChange={e => setEditModal(prev => ({
                                                    ...prev,
                                                    weights: { ...prev.weights, [key]: parseFloat(e.target.value) || 0 }
                                                }))}
                                                className="flex-1 accent-primary"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className={`mt-8 flex items-center justify-between p-4 rounded-2xl border transition-all ${weightSumOk ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-destructive/10 border-destructive/20'}`}>
                                <div className="flex items-center gap-2">
                                    {weightSumOk ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-destructive" />}
                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                        {weightSumOk ? "Balanced" : `Sum: ${weightSum.toFixed(2)} / 1.00`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setEditModal(p => ({ ...p, open: false }))} className="flex-1 py-4 rounded-2xl border border-border font-bold text-sm hover:bg-muted transition-colors uppercase tracking-widest">
                            Cancel
                        </button>
                        <button
                            onClick={saveRepoConfig}
                            disabled={!weightSumOk}
                            className="flex-1 py-4 rounded-2xl bg-primary text-primary-foreground font-black text-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-widest shadow-glow-sm"
                        >
                            Save Configuration
                        </button>
                    </div>
                </div>
            </div>
        )}

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
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => fetchData(token)}
                        className="p-3 rounded-2xl bg-secondary hover:bg-secondary/80 transition-all text-muted-foreground"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                    </button>
                    <div className="h-10 w-[1px] bg-border mx-2" />
                    <button onClick={handleExecutePayout} disabled={isExecutingPayout} className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-glow-sm disabled:opacity-50">
                        {isExecutingPayout ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                        Execute Payouts
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

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Bounty Pool</span>
                        <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <Wallet className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <div className="text-3xl font-black font-mono">{totalAllocatedPool.toLocaleString()} FLOW</div>
                        <div className="text-xs font-bold text-muted-foreground mt-0.5">{formatUSD(totalAllocatedPool)} USD</div>
                    </div>
                    <div className="text-sm text-emerald-500 font-medium mt-1 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        Verified Rewards
                    </div>
                </div>

                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Contributors</span>
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-3xl font-black font-mono">{safeContributors.length}</div>
                    <div className="text-sm text-muted-foreground mt-1 font-medium italic">Across {repos.length} repositories</div>
                </div>

                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Network Score</span>
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-3xl font-black font-mono">{totalScoreAvg}/100</div>
                    <div className="text-sm text-muted-foreground mt-1 font-medium">Mean ecosystem impact</div>
                </div>

                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/30 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cycle Status</span>
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                            <Activity className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-3xl font-black font-mono uppercase">Live</div>
                    <div className="w-full bg-muted rounded-full h-2 mt-4 overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[100%] transition-all" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Repository Configuration */}
                    <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-8">
                            <Activity className="w-6 h-6 text-primary" />
                            <h2 className="text-2xl font-black tracking-tight">Org Configuration</h2>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newRepo} 
                                    onChange={e => setNewRepo(e.target.value)} 
                                    placeholder="Add new repository (e.g. owner/repo)" 
                                    className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm font-mono text-foreground focus:outline-none focus:border-primary/50"
                                />
                                <button onClick={addRepo} className="bg-primary text-primary-foreground font-bold px-6 rounded-xl text-sm hover:opacity-90 transition-all">Add Repo</button>
                            </div>

                            <div className="space-y-4">
                            {repos.map(r => (
                                <div key={r.name} className="p-6 bg-muted/10 border border-border rounded-2xl flex flex-col gap-4">
                                    {/* Repo name header */}
                                    <div className="flex items-center justify-between border-b border-border pb-4 mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shadow-sm">
                                                <Github className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                            <span className="text-xl font-black font-mono text-foreground">{r.name}</span>
                                        </div>
                                        <button
                                            onClick={() => openEditModal(r)}
                                            className="flex items-center gap-2 text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl hover:bg-primary hover:text-primary-foreground transition-all uppercase tracking-widest shadow-sm"
                                        >
                                            <SlidersHorizontal className="w-3.5 h-3.5" /> Edit Config
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Target Branches */}
                                        <div className="p-4 bg-background border border-border rounded-2xl flex flex-col gap-3">
                                            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                <GitBranch className="w-3 h-3" /> Branches
                                            </h3>
                                            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                                                {r.targetBranches.length > 0 ? r.targetBranches.map(b => (
                                                    <span key={b} className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-bold font-mono">{b}</span>
                                                )) : (
                                                    <span className="text-[10px] text-muted-foreground italic">No branches tracked</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bounty Pool */}
                                        <div className="p-4 bg-background border border-border rounded-2xl flex flex-col gap-3">
                                            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                <Wallet className="w-3 h-3" /> Bounty Pool
                                            </h3>
                                            <div>
                                                <div className="text-lg font-black font-mono text-foreground leading-none">{(r.bountyPool || 100).toLocaleString()} FLOW</div>
                                                <div className="text-[10px] font-bold text-muted-foreground mt-1">{formatUSD(r.bountyPool || 100)} USD</div>
                                            </div>
                                        </div>

                                        {/* Algo Weights */}
                                        <div className="p-4 bg-background border border-border rounded-2xl flex flex-col gap-3">
                                            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                                <Zap className="w-3 h-3" /> Weights
                                            </h3>
                                            <div className="space-y-1">
                                                {Object.entries(r.weights).map(([k, v]) => (
                                                    <div key={k} className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-muted-foreground uppercase w-14 shrink-0">{k.substring(0,3)}</span>
                                                        <div className="flex-1 bg-muted rounded-full h-1 overflow-hidden">
                                                            <div className="bg-primary h-full rounded-full" style={{ width: `${(v as number) * 100}%` }} />
                                                        </div>
                                                        <span className="text-[9px] font-black font-mono text-muted-foreground w-8 text-right">{(v as number).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    </div>

                    {/* Individual Repo Stats */}
                    {repos.length > 0 && (
                        <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
                            <div className="flex items-center gap-3 mb-8">
                                <BarChart3 className="w-6 h-6 text-primary" />
                                <h2 className="text-2xl font-black tracking-tight">Repository Stats</h2>
                                <span className="ml-auto text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/30 px-3 py-1 rounded-full border border-border">{repos.length} Repos</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {repos.map(r => {
                                    // Compute per-repo contributor count and PR count from contributors data
                                    const repoContributors = safeContributors.filter(c =>
                                        safeRecentEvents.some(e => e.repo === r.name && e.username === c.username)
                                    );
                                    const repoPRs = safeRecentEvents.filter(e => e.repo === r.name);
                                    const repoAvgScore = repoPRs.length > 0
                                        ? (repoPRs.reduce((sum, e) => sum + e.score, 0) / repoPRs.length).toFixed(1)
                                        : "—";
                                    const weightEntries = Object.entries(r.weights);
                                    const totalWeight = weightEntries.reduce((s, [, v]) => s + (v as number), 0) || 1;
                                    return (
                                        <div key={r.name} className="p-5 bg-muted/10 border border-border rounded-3xl flex flex-col gap-4 hover:border-primary/30 transition-all group">
                                            {/* Repo header */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Github className="w-4 h-4 text-muted-foreground" />
                                                    <span className="text-sm font-black font-mono text-foreground truncate max-w-[140px]" title={r.name}>{r.name}</span>
                                                </div>
                                                <a href={`https://github.com/${r.name}`} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
                                                </a>
                                            </div>

                                            {/* Quick stats row */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="p-2 bg-background border border-border rounded-xl text-center">
                                                    <div className="text-lg font-black font-mono text-primary">{repoContributors.length || safeContributors.length}</div>
                                                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">Devs</div>
                                                </div>
                                                <div className="p-2 bg-background border border-border rounded-xl text-center">
                                                    <div className="text-lg font-black font-mono">{repoPRs.length}</div>
                                                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">PRs</div>
                                                </div>
                                                <div className="p-2 bg-background border border-border rounded-xl text-center">
                                                    <div className="text-lg font-black font-mono text-emerald-500">{repoAvgScore}</div>
                                                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">Avg Pts</div>
                                                </div>
                                            </div>

                                            {/* Target branches */}
                                            <div>
                                                <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Tracked Branches</div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {r.targetBranches.length > 0 ? r.targetBranches.map(b => (
                                                        <span key={b} className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-bold font-mono">{b}</span>
                                                    )) : (
                                                        <span className="text-[10px] text-muted-foreground italic">No branches set</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Weight bars */}
                                            <div>
                                                <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Algo Weights</div>
                                                <div className="space-y-1.5">
                                                    {weightEntries.map(([key, val]) => (
                                                        <div key={key} className="flex items-center gap-2">
                                                            <span className="text-[9px] font-black text-muted-foreground uppercase w-10 shrink-0">{key.substring(0,3)}</span>
                                                            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                                                <div
                                                                    className="bg-primary h-full rounded-full transition-all"
                                                                    style={{ width: `${((val as number) / totalWeight) * 100}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-[9px] font-black font-mono text-muted-foreground w-6 text-right">{(val as number).toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Real Payout Table */}
                    <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-sm">
                        <div className="p-8 border-b border-border flex items-center justify-between bg-muted/5">
                            <div className="flex items-center gap-3">
                                <Award className="w-6 h-6 text-primary" />
                                <h2 className="text-2xl font-black tracking-tight">Algorithmic Valuation</h2>
                            </div>
                            <button className="text-[10px] font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 px-4 py-2 border border-border rounded-xl bg-background uppercase tracking-widest shadow-sm">
                                <Download className="w-3.5 h-3.5" />
                                Snapshot Archive
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/10 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                        <th className="px-8 py-5">Contributor</th>
                                        <th className="px-8 py-5">Performance Map</th>
                                        <th className="px-8 py-5">Computed Score</th>
                                        <th className="px-8 py-5">FLOW Share</th>
                                        <th className="px-8 py-5 text-right">Verification</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {safeContributors.map((c, i) => (
                                        <tr key={c.username} className="hover:bg-muted/10 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <img src={c.avatar} className="w-8 h-8 rounded-xl border border-border" alt={c.username} />
                                                    <span className="font-bold text-sm">@{c.username}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="px-2 py-0.5 bg-muted text-[10px] font-black rounded uppercase tracking-tighter opacity-70">
                                                        {c.prCount} PRs Merged
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                                        <div className="bg-primary h-full transition-all" style={{ width: `${c.totalScore}%` }} />
                                                    </div>
                                                    <span className="text-xs font-black font-mono">{c.totalScore}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="font-mono font-black text-emerald-500">{Math.round(c.totalScore * 5)} FLOW</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground mt-0.5">{formatUSD(Math.round(c.totalScore * 5))} USD</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-1.5 text-[9px] text-primary font-black uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20 inline-flex group-hover:scale-105 transition-transform">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    Proof Verified
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {safeContributors.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-8 py-12 text-center text-muted-foreground italic font-medium opacity-60">No contributors discovered in organization repositories.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                    {/* Execution Center */}
                    <div className="bg-[#0c0c0c] text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-8">
                                <ShieldAlert className="w-6 h-6 text-primary" />
                                <h2 className="text-2xl font-black tracking-tight uppercase tracking-tighter">Settlement Layer</h2>
                            </div>

                            <div className="space-y-1 mb-8">
                                <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3">Governance Approvals (2/3)</div>
                                <div className="flex gap-2">
                                    {signatures.map((signed, i) => (
                                        <div
                                            key={i}
                                            className={`flex-1 h-14 rounded-2xl border flex items-center justify-center transition-all ${signed ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-white/10'}`}
                                        >
                                            {signed ? <CheckCircle className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <p className="text-sm text-white/50 mb-8 leading-relaxed font-medium">
                                Multi-sig required to stream <span className="text-primary font-black">{totalPayout.toLocaleString()} FLOW</span> (~{formatUSD(totalPayout)} USD). Transaction builds upon <span className="underline decoration-primary/50 underline-offset-4 decoration-2">Algorithmic Valuation Snapshot #421</span>.
                            </p>

                            <button onClick={handleExecutePayout} disabled={isExecutingPayout} className="w-full bg-primary text-primary-foreground font-black py-4 rounded-[1.25rem] hover:scale-[0.98] active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
                                {isExecutingPayout ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                                Sign & Execute
                            </button>
                        </div>
                    </div>

                    {/* Leaderboard Card */}
                    <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Award className="w-5 h-5 text-primary" />
                                <h2 className="text-xl font-bold font-heading">Leaderboard</h2>
                            </div>
                            <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded">CYCLE 4</span>
                        </div>
                        <div className="space-y-6">
                            {safeContributors.slice(0, 5).map((user, i) => (
                                <div key={user.username} className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/10 transition-all cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                            <img src={user.avatar} className="w-8 h-8 rounded-lg" alt="" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-black">@{user.username}</div>
                                            <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Global Influencer</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black font-mono text-primary">{user.totalScore}</div>
                                        <div className="text-[9px] text-muted-foreground uppercase font-black">Pts</div>
                                    </div>
                                </div>
                            ))}
                            {safeContributors.length === 0 && (
                                <p className="text-xs text-muted-foreground italic text-center py-4">Scanning for top contributors...</p>
                            )}
                        </div>
                    </div>

                    {/* Infrastructure Audit (Real Events) */}
                    <div className="bg-[#050505] border border-white/5 rounded-[2.5rem] p-8 shadow-inner">
                        <div className="flex items-center gap-3 mb-6">
                            <Database className="w-4 h-4 text-primary" />
                            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Audit Archive (IPFS)</h3>
                        </div>
                        <div className="space-y-4">
                            {safeRecentEvents.map((event, i) => (
                                <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2 group hover:bg-white/10 transition-all cursor-pointer">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                                            <span className="text-[10px] font-black text-white/80">@{event.username} Merged</span>
                                        </div>
                                        <span className="text-[9px] font-black text-emerald-500">+{event.score} PTS</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[9px] font-mono text-white/30 truncate max-w-[150px]">{event.cid}</span>
                                        <ExternalLink className="w-3 h-3 text-white/10 group-hover:text-primary transition-colors flex-shrink-0" />
                                    </div>
                                </div>
                            ))}
                            {safeRecentEvents.length === 0 && (
                                <div className="text-center py-8">
                                    <FileSearch className="w-8 h-8 text-white/10 mx-auto mb-3" />
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">No recent audit logs</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </>
    );
}

