"use client";
import { useState, useEffect, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import TopBar from "../../components/TopBar";
import { IconSearch, IconClose, IconChevronDown } from "../../components/Icons";

const contributions = [
    { repo: "vercel/next.js", commits: 47, prs: 12, dependents: 8420, bounty: 4250, language: "TypeScript" },
    { repo: "prisma/prisma", commits: 31, prs: 8, dependents: 5130, bounty: 2890, language: "Rust" },
    { repo: "tailwindlabs/tailwindcss", commits: 23, prs: 6, dependents: 12300, bounty: 5120, language: "JavaScript" },
    { repo: "drizzle-team/drizzle-orm", commits: 58, prs: 15, dependents: 2100, bounty: 3450, language: "TypeScript" },
    { repo: "trpc/trpc", commits: 19, prs: 4, dependents: 3780, bounty: 1680, language: "TypeScript" },
    { repo: "withastro/astro", commits: 14, prs: 3, dependents: 4200, bounty: 2100, language: "JavaScript" },
    { repo: "t3-oss/create-t3-app", commits: 9, prs: 2, dependents: 1540, bounty: 890, language: "TypeScript" },
    { repo: "shadcn-ui/ui", commits: 35, prs: 10, dependents: 6200, bounty: 4100, language: "TypeScript" },
];

const monthLabels = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"];

function getBarData(repo) {
    const seed = repo.length;
    return monthLabels.map((_, i) => 20 + ((seed * (i + 1) * 37) % 80));
}

export default function ContributionsPage() {
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("bounty");
    const [sortDir, setSortDir] = useState("desc");
    const [selectedRow, setSelectedRow] = useState(null);

    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const isDark = theme === "dark";
    const cardBg = isDark ? "glass" : "bg-white border border-[#E5E2DC] shadow-sm";
    const mutedText = isDark ? "text-[#94A3B8]" : "text-[#6B7280]";
    const headerBg = isDark ? "bg-[#0D1321]" : "bg-[#F5F3F0]";
    const rowHover = isDark ? "hover:bg-[#1A2235]" : "hover:bg-[#F5F3F0]";

    const filtered = useMemo(() => {
        let result = contributions.filter((c) =>
            c.repo.toLowerCase().includes(search.toLowerCase())
        );
        result.sort((a, b) => {
            const dir = sortDir === "asc" ? 1 : -1;
            return (a[sortBy] - b[sortBy]) * dir;
        });
        return result;
    }, [search, sortBy, sortDir]);

    const toggleSort = (col) => {
        if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortBy(col);
            setSortDir("desc");
        }
    };

    const SortHeader = ({ col, label }) => (
        <th
            className={`px-4 py-3 text-left text-xs font-bold cursor-pointer select-none transition-colors hover:text-[#00E5CC] ${mutedText}`}
            onClick={() => toggleSort(col)}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                {sortBy === col && (
                    <IconChevronDown
                        className={`w-3 h-3 transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`}
                    />
                )}
            </span>
        </th>
    );

    return (
        <>
            <TopBar title="My Contributions" />
            <div className="p-4 lg:p-6 animate-fade-in-up">
                {/* Search Bar */}
                <div className="mb-6">
                    <div className={`relative max-w-md`}>
                        <IconSearch className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedText}`} />
                        <input
                            id="contributions-search"
                            type="text"
                            placeholder="Search repositories..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 ${isDark
                                    ? "bg-[#1A2235] border border-[#1E293B] focus:border-[#00E5CC] text-white placeholder-[#475569]"
                                    : "bg-white border border-[#E5E2DC] focus:border-[#00E5CC] text-gray-900 placeholder-[#9CA3AF]"
                                }`}
                        />
                    </div>
                </div>

                {/* Table */}
                <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className={headerBg}>
                                    <th className={`px-4 py-3 text-left text-xs font-bold ${mutedText}`}>Repository</th>
                                    <SortHeader col="commits" label="Commits" />
                                    <SortHeader col="prs" label="PRs Merged" />
                                    <SortHeader col="dependents" label="Dependents" />
                                    <SortHeader col="bounty" label="Bounty Earned" />
                                    <th className={`px-4 py-3 text-left text-xs font-bold ${mutedText}`}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((c, i) => (
                                    <tr
                                        key={c.repo}
                                        className={`border-t cursor-pointer transition-colors ${rowHover} ${isDark ? "border-[#1E293B]" : "border-[#F0EEEB]"
                                            }`}
                                        onClick={() => setSelectedRow(c)}
                                    >
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-matter ${isDark ? "bg-[#1A2235]" : "bg-[#F5F3F0]"}`}>
                                                    {c.repo.split("/")[0][0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{c.repo}</p>
                                                    <p className={`text-xs ${mutedText}`}>{c.language}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-sm font-matter">{c.commits}</td>
                                        <td className="px-4 py-3.5 text-sm font-matter">{c.prs}</td>
                                        <td className="px-4 py-3.5 text-sm font-matter">{c.dependents.toLocaleString()}</td>
                                        <td className="px-4 py-3.5 text-sm font-bold text-[#00E5CC] font-matter">${c.bounty.toLocaleString()}</td>
                                        <td className="px-4 py-3.5">
                                            <span className={`text-xs ${mutedText}`}>View →</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detail Drawer */}
                {selectedRow && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/40 z-40"
                            onClick={() => setSelectedRow(null)}
                        />
                        <div
                            className={`fixed top-0 right-0 h-full w-full sm:w-[480px] z-50 overflow-y-auto animate-slide-in-right ${isDark ? "bg-[#0D1321] border-l border-[#1E293B]" : "bg-white border-l border-[#E5E2DC]"
                                }`}
                        >
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                                        {selectedRow.repo}
                                    </h2>
                                    <button
                                        onClick={() => setSelectedRow(null)}
                                        className="p-2 rounded-lg hover:bg-[#1A2235] transition-colors cursor-pointer"
                                    >
                                        <IconClose className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    {[
                                        { label: "Commits", value: selectedRow.commits },
                                        { label: "PRs Merged", value: selectedRow.prs },
                                        { label: "Dependents", value: selectedRow.dependents.toLocaleString() },
                                        { label: "Bounty Earned", value: `$${selectedRow.bounty.toLocaleString()}` },
                                    ].map((s) => (
                                        <div key={s.label} className={`rounded-xl p-4 ${isDark ? "bg-[#1A2235]" : "bg-[#F5F3F0]"}`}>
                                            <p className={`text-xs ${mutedText} mb-1`}>{s.label}</p>
                                            <p className="text-xl font-bold font-matter">{s.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Bar Chart */}
                                <div className="mb-6">
                                    <h3 className="text-sm font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                                        Contribution History (6 months)
                                    </h3>
                                    <svg viewBox="0 0 320 160" className="w-full">
                                        {getBarData(selectedRow.repo).map((val, i) => {
                                            const barW = 36;
                                            const gap = (320 - barW * 6) / 7;
                                            const x = gap + i * (barW + gap);
                                            const h = (val / 100) * 120;
                                            return (
                                                <g key={i}>
                                                    <rect
                                                        x={x} y={130 - h} width={barW} height={h}
                                                        rx="4"
                                                        fill="url(#barGrad)"
                                                        opacity={0.85}
                                                    />
                                                    <text
                                                        x={x + barW / 2} y={150}
                                                        textAnchor="middle"
                                                        fill={isDark ? "#94A3B8" : "#6B7280"}
                                                        fontSize="10"
                                                        style={{ fontFamily: "var(--font-mono)" }}
                                                    >
                                                        {monthLabels[i]}
                                                    </text>
                                                    <text
                                                        x={x + barW / 2} y={125 - h}
                                                        textAnchor="middle"
                                                        fill="#00E5CC"
                                                        fontSize="9"
                                                        fontWeight="bold"
                                                        style={{ fontFamily: "var(--font-mono)" }}
                                                    >
                                                        {val}
                                                    </text>
                                                </g>
                                            );
                                        })}
                                        <defs>
                                            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#00E5CC" />
                                                <stop offset="100%" stopColor="#00B4D8" stopOpacity="0.6" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                </div>

                                {/* Language & Info */}
                                <div className={`rounded-xl p-4 ${isDark ? "bg-[#1A2235]" : "bg-[#F5F3F0]"}`}>
                                    <p className={`text-xs ${mutedText} mb-2`}>Primary Language</p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#00E5CC]" />
                                        <span className="text-sm font-medium">{selectedRow.language}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
