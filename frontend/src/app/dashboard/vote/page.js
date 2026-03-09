"use client";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import TopBar from "../../components/TopBar";
import { IconLock, IconCheck } from "../../components/Icons";

const initialProjects = [
    { id: 1, name: "Drizzle ORM", desc: "TypeScript ORM for SQL databases", votes: 0, currentFunding: 24 },
    { id: 2, name: "tRPC", desc: "End-to-end typesafe APIs", votes: 0, currentFunding: 18 },
    { id: 3, name: "Astro", desc: "The web framework for content-driven websites", votes: 0, currentFunding: 31 },
    { id: 4, name: "SvelteKit", desc: "Web development, streamlined", votes: 0, currentFunding: 15 },
    { id: 5, name: "Prisma", desc: "Next-generation Node.js and TypeScript ORM", votes: 0, currentFunding: 22 },
    { id: 6, name: "Zod", desc: "TypeScript-first schema validation", votes: 0, currentFunding: 12 },
];

export default function VotePage() {
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [projects, setProjects] = useState(initialProjects);
    const [locked, setLocked] = useState(false);
    const [showLockAnim, setShowLockAnim] = useState(false);

    useEffect(() => setMounted(true), []);

    const totalCredits = 100;

    const creditsUsed = projects.reduce((sum, p) => sum + p.votes * p.votes, 0);
    const remaining = totalCredits - creditsUsed;

    const handleVoteChange = useCallback((id, newVotes) => {
        if (locked) return;
        const numVotes = parseInt(newVotes) || 0;
        setProjects((prev) => {
            const updated = prev.map((p) =>
                p.id === id ? { ...p, votes: numVotes } : p
            );
            const totalCost = updated.reduce((sum, p) => sum + p.votes * p.votes, 0);
            if (totalCost > totalCredits) return prev;
            return updated;
        });
    }, [locked]);

    const handleLock = () => {
        setShowLockAnim(true);
        setTimeout(() => {
            setLocked(true);
            setShowLockAnim(false);
        }, 600);
    };

    if (!mounted) return null;

    const isDark = theme === "dark";
    const cardBg = isDark ? "glass" : "bg-white border border-[#E5E2DC] shadow-sm";
    const mutedText = isDark ? "text-[#94A3B8]" : "text-[#6B7280]";

    const maxFunding = Math.max(...projects.map((p) => p.currentFunding + p.votes * 10));

    return (
        <>
            <TopBar title="Quadratic Voting" />
            <div className="p-4 lg:p-6 animate-fade-in-up">
                {/* Credits Counter */}
                <div className={`rounded-2xl p-6 mb-6 ${cardBg}`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "var(--font-heading)" }}>
                                Allocate Your Credits
                            </h2>
                            <p className={`text-sm ${mutedText}`}>
                                Distribute 100 credits across open-source projects. Cost per vote = votes² (quadratic).
                            </p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <p className={`text-xs ${mutedText} mb-1`}>Remaining</p>
                                <p className={`text-3xl font-bold font-matter ${remaining < 10 ? "text-red-400" : "text-[#00E5CC]"}`}>
                                    {remaining}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className={`text-xs ${mutedText} mb-1`}>Used</p>
                                <p className="text-3xl font-bold font-matter">{creditsUsed}</p>
                            </div>
                        </div>
                    </div>

                    {/* Credits progress bar */}
                    <div className={`mt-4 h-2 rounded-full ${isDark ? "bg-[#1E293B]" : "bg-[#E5E2DC]"}`}>
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${remaining < 10 ? "bg-red-400" : "bg-gradient-to-r from-[#00E5CC] to-[#00B4D8]"
                                }`}
                            style={{ width: `${(creditsUsed / totalCredits) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Project Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                    {projects.map((project) => {
                        const cost = project.votes * project.votes;
                        return (
                            <div
                                key={project.id}
                                className={`rounded-xl p-5 transition-all duration-200 hover-lift ${locked ? "opacity-80" : ""
                                    } ${cardBg} ${showLockAnim ? "lock-animation" : ""}`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                                            {project.name}
                                        </h3>
                                        <p className={`text-xs ${mutedText}`}>{project.desc}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold font-matter text-[#00E5CC]">{project.votes}</p>
                                        <p className={`text-xs ${mutedText}`}>votes ({cost} credits)</p>
                                    </div>
                                </div>

                                {/* Slider */}
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    value={project.votes}
                                    onChange={(e) => handleVoteChange(project.id, e.target.value)}
                                    disabled={locked}
                                    className="w-full mb-4"
                                />

                                {/* Current Funding Bar */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`text-xs ${mutedText}`}>Current allocation</span>
                                        <span className="text-xs font-bold font-matter text-[#00E5CC]">
                                            {project.currentFunding + project.votes * 10}%
                                        </span>
                                    </div>
                                    <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? "bg-[#1E293B]" : "bg-[#E5E2DC]"}`}>
                                        <div className="h-full flex">
                                            <div
                                                className="h-full bg-[#00E5CC]/30 transition-all duration-300"
                                                style={{ width: `${(project.currentFunding / maxFunding) * 100}%` }}
                                            />
                                            <div
                                                className="h-full bg-[#00E5CC] transition-all duration-300"
                                                style={{ width: `${((project.votes * 10) / maxFunding) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Lock Vote Button */}
                <div className="flex justify-center">
                    {!locked ? (
                        <button
                            id="lock-vote-btn"
                            onClick={handleLock}
                            disabled={creditsUsed === 0}
                            className={`inline-flex items-center gap-2 px-10 py-3.5 font-bold rounded-xl transition-all duration-200 cursor-pointer ${creditsUsed === 0
                                    ? "bg-gray-500/30 text-gray-500 cursor-not-allowed"
                                    : "bg-[#00E5CC] text-[#0A0F1E] hover:bg-[#00D4BD] hover:shadow-xl hover:shadow-[#00E5CC]/25 hover:-translate-y-0.5"
                                }`}
                        >
                            <IconLock className="w-4 h-4" />
                            Lock Votes
                        </button>
                    ) : (
                        <div className="flex items-center gap-3 px-10 py-3.5 rounded-xl bg-[#00E5CC]/10 border border-[#00E5CC]/30 animate-scale-in">
                            <IconCheck className="w-5 h-5 text-[#00E5CC]" />
                            <span className="font-bold text-[#00E5CC]">Votes Locked Successfully</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
