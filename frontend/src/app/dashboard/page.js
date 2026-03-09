"use client";
import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import TopBar from "../components/TopBar";
import { IconArrowRight } from "../components/Icons";

const recentActivity = [
    { repo: "vercel/next.js", type: "PR Merged", bounty: "+$340", time: "2 hours ago", status: "completed" },
    { repo: "prisma/prisma", type: "Bug Fix", bounty: "+$120", time: "5 hours ago", status: "completed" },
    { repo: "tailwindlabs/tailwindcss", type: "Feature", bounty: "+$580", time: "1 day ago", status: "completed" },
    { repo: "drizzle-team/drizzle-orm", type: "PR Merged", bounty: "+$215", time: "2 days ago", status: "pending" },
    { repo: "trpc/trpc", type: "Docs Update", bounty: "+$85", time: "3 days ago", status: "completed" },
];

const dependencyNodes = [
    { id: "you", x: 200, y: 120, label: "Your Code", main: true },
    { id: "next", x: 60, y: 40, label: "next.js" },
    { id: "prisma", x: 340, y: 40, label: "prisma" },
    { id: "trpc", x: 60, y: 200, label: "trpc" },
    { id: "tailwind", x: 340, y: 200, label: "tailwindcss" },
    { id: "astro", x: 200, y: 250, label: "astro" },
];

const dependencyEdges = [
    ["you", "next"],
    ["you", "prisma"],
    ["you", "trpc"],
    ["you", "tailwind"],
    ["you", "astro"],
];

export default function DashboardPage() {
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [valueScore, setValueScore] = useState(0);

    useEffect(() => {
        setMounted(true);
        const timer = setTimeout(() => setValueScore(78), 300);
        return () => clearTimeout(timer);
    }, []);

    if (!mounted) return null;

    const isDark = theme === "dark";
    const cardBg = isDark ? "glass" : "bg-white border border-[#E5E2DC] shadow-sm";
    const mutedText = isDark ? "text-[#94A3B8]" : "text-[#6B7280]";
    const scoreOffset = 283 - (283 * valueScore) / 100;

    const getNodePos = (id) => dependencyNodes.find((n) => n.id === id);

    return (
        <>
            <TopBar title="Overview" />
            <div className="p-4 lg:p-6 space-y-6 animate-fade-in-up">
                {/* Top Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: "Total Earned", value: "$12,450", change: "+18.2% this month" },
                        { label: "Active Bounties", value: "7", change: "3 claimable" },
                        { label: "Dependents", value: "1,247", change: "+32 this week" },
                        { label: "Global Rank", value: "#142", change: "Up 12 spots" },
                    ].map((stat) => (
                        <div key={stat.label} className={`rounded-xl p-5 transition-theme hover-lift ${cardBg}`}>
                            <p className={`text-xs font-medium mb-1 ${mutedText}`}>{stat.label}</p>
                            <p className="text-2xl font-bold font-matter">{stat.value}</p>
                            <p className="text-xs text-[#00E5CC] mt-1 font-medium">{stat.change}</p>
                        </div>
                    ))}
                </div>

                {/* Main content grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Value Score Card */}
                    <div className={`rounded-2xl p-6 ${cardBg} hover-lift`}>
                        <h3 className="text-sm font-bold mb-6" style={{ fontFamily: "var(--font-heading)" }}>
                            Your Value Score
                        </h3>
                        <div className="flex items-center justify-center mb-6">
                            <div className="relative w-40 h-40">
                                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                    <circle
                                        cx="50" cy="50" r="45"
                                        stroke={isDark ? "#1E293B" : "#E5E2DC"}
                                        strokeWidth="8"
                                        fill="none"
                                    />
                                    <circle
                                        cx="50" cy="50" r="45"
                                        stroke="url(#scoreGrad)"
                                        strokeWidth="8"
                                        fill="none"
                                        strokeDasharray="283"
                                        strokeDashoffset={scoreOffset}
                                        strokeLinecap="round"
                                        className="radial-progress-animate"
                                        style={{ transition: "stroke-dashoffset 1.5s ease" }}
                                    />
                                    <defs>
                                        <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#00E5CC" />
                                            <stop offset="100%" stopColor="#00B4D8" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-4xl font-bold font-matter text-[#00E5CC]">{valueScore}</span>
                                    <span className={`text-xs ${mutedText}`}>out of 100</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {[
                                { label: "Code Quality", pct: 85 },
                                { label: "Downstream Impact", pct: 72 },
                                { label: "Consistency", pct: 91 },
                                { label: "Community Trust", pct: 68 },
                            ].map((m) => (
                                <div key={m.label}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-xs ${mutedText}`}>{m.label}</span>
                                        <span className="text-xs font-bold font-matter">{m.pct}%</span>
                                    </div>
                                    <div className={`h-1.5 rounded-full ${isDark ? "bg-[#1E293B]" : "bg-[#E5E2DC]"}`}>
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-[#00E5CC] to-[#00B4D8] transition-all duration-1000"
                                            style={{ width: `${m.pct}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Activity Feed */}
                    <div className={`rounded-2xl p-6 ${cardBg} hover-lift`}>
                        <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                            Recent Bounty Activity
                        </h3>
                        <div className="space-y-3">
                            {recentActivity.map((a, i) => (
                                <div
                                    key={i}
                                    className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${isDark ? "hover:bg-[#1A2235]" : "hover:bg-[#F5F3F0]"
                                        }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.status === "completed" ? "bg-[#00E5CC]/10" : "bg-yellow-500/10"
                                            }`}>
                                            <div className={`w-2 h-2 rounded-full ${a.status === "completed" ? "bg-[#00E5CC]" : "bg-yellow-500 animate-pulse"
                                                }`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{a.repo}</p>
                                            <p className={`text-xs ${mutedText}`}>{a.type} · {a.time}</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-[#00E5CC] font-matter flex-shrink-0 ml-2">{a.bounty}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Dependency Graph */}
                    <div className={`rounded-2xl p-6 ${cardBg} hover-lift`}>
                        <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                            Dependency Graph
                        </h3>
                        <p className={`text-xs mb-4 ${mutedText}`}>Projects that depend on your code</p>
                        <svg viewBox="0 0 400 280" className="w-full h-auto">
                            {/* Edges */}
                            {dependencyEdges.map(([from, to], i) => {
                                const f = getNodePos(from);
                                const t = getNodePos(to);
                                return (
                                    <line
                                        key={i}
                                        x1={f.x} y1={f.y} x2={t.x} y2={t.y}
                                        stroke="#00E5CC"
                                        strokeWidth="1.5"
                                        strokeOpacity="0.3"
                                        strokeDasharray="4 4"
                                    />
                                );
                            })}
                            {/* Nodes */}
                            {dependencyNodes.map((node) => (
                                <g key={node.id}>
                                    <circle
                                        cx={node.x} cy={node.y}
                                        r={node.main ? 28 : 20}
                                        fill={node.main ? "rgba(0,229,204,0.15)" : isDark ? "#1A2235" : "#F5F3F0"}
                                        stroke={node.main ? "#00E5CC" : isDark ? "#334155" : "#D1D5DB"}
                                        strokeWidth={node.main ? 2 : 1}
                                    />
                                    {node.main && (
                                        <circle cx={node.x} cy={node.y} r="28" stroke="#00E5CC" strokeWidth="2" fill="none" strokeOpacity="0.3">
                                            <animate attributeName="r" values="28;34;28" dur="2s" repeatCount="indefinite" />
                                            <animate attributeName="stroke-opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
                                        </circle>
                                    )}
                                    <text
                                        x={node.x} y={node.y + 4}
                                        textAnchor="middle"
                                        fill={node.main ? "#00E5CC" : isDark ? "#94A3B8" : "#6B7280"}
                                        fontSize={node.main ? "9" : "8"}
                                        fontWeight={node.main ? "bold" : "normal"}
                                        style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                        {node.label}
                                    </text>
                                </g>
                            ))}
                        </svg>
                    </div>
                </div>

                {/* Claim Bounty CTA */}
                <div
                    className={`rounded-2xl p-8 text-center animated-gradient ${isDark ? "glass" : "bg-gradient-to-r from-[#00E5CC]/5 to-[#00B4D8]/5 border border-[#E5E2DC]"
                        }`}
                    style={{
                        backgroundImage: isDark
                            ? "linear-gradient(135deg, rgba(0,229,204,0.08), rgba(0,180,216,0.05), rgba(0,229,204,0.08))"
                            : undefined,
                    }}
                >
                    <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                        You have 3 bounties ready to claim
                    </h3>
                    <p className={`text-sm mb-6 ${mutedText}`}>
                        Total claimable: <span className="text-[#00E5CC] font-bold font-matter">$1,340 FLOW</span>
                    </p>
                    <button
                        id="claim-bounty-btn"
                        className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#00E5CC] text-[#0A0F1E] font-bold rounded-xl hover:bg-[#00D4BD] transition-all duration-200 hover:shadow-xl hover:shadow-[#00E5CC]/25 hover:-translate-y-0.5 cursor-pointer"
                    >
                        Claim Bounty
                        <IconArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </>
    );
}
