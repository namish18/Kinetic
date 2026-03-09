"use client";
import { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import TopBar from "../../components/TopBar";

const leaderboardData = [
    { rank: 1, name: "Sarah Chen", handle: "sarahchen", score: 97, earned: "$48,200", country: "🇺🇸" },
    { rank: 2, name: "Marcus Oliveira", handle: "marcusoliv", score: 94, earned: "$41,800", country: "🇧🇷" },
    { rank: 3, name: "Yuki Tanaka", handle: "yukitanaka", score: 91, earned: "$38,500", country: "🇯🇵" },
    { rank: 4, name: "Priya Sharma", handle: "priyasharma", score: 89, earned: "$35,100", country: "🇮🇳" },
    { rank: 5, name: "Leon Fischer", handle: "leonfischer", score: 87, earned: "$32,700", country: "🇩🇪" },
    { rank: 6, name: "Amara Okafor", handle: "amaraokafor", score: 85, earned: "$29,400", country: "🇳🇬" },
    { rank: 7, name: "Erik Lindgren", handle: "eriklindgren", score: 83, earned: "$27,200", country: "🇸🇪" },
    { rank: 8, name: "Sofia Reyes", handle: "sofiareyes", score: 81, earned: "$24,800", country: "🇲🇽" },
    { rank: 9, name: "Jin Park", handle: "jinpark", score: 79, earned: "$22,500", country: "🇰🇷" },
    { rank: 10, name: "Liam O'Brien", handle: "liamobrien", score: 78, earned: "$20,100", country: "🇮🇪" },
];

const monthlyData = [
    { rank: 1, name: "Jin Park", handle: "jinpark", score: 96, earned: "$6,200", country: "🇰🇷" },
    { rank: 2, name: "Sarah Chen", handle: "sarahchen", score: 93, earned: "$5,800", country: "🇺🇸" },
    { rank: 3, name: "Amara Okafor", handle: "amaraokafor", score: 90, earned: "$5,100", country: "🇳🇬" },
    { rank: 4, name: "Leon Fischer", handle: "leonfischer", score: 88, earned: "$4,700", country: "🇩🇪" },
    { rank: 5, name: "Priya Sharma", handle: "priyasharma", score: 85, earned: "$4,200", country: "🇮🇳" },
    { rank: 6, name: "Marcus Oliveira", handle: "marcusoliv", score: 82, earned: "$3,900", country: "🇧🇷" },
    { rank: 7, name: "Sofia Reyes", handle: "sofiareyes", score: 80, earned: "$3,500", country: "🇲🇽" },
    { rank: 8, name: "Yuki Tanaka", handle: "yukitanaka", score: 78, earned: "$3,100", country: "🇯🇵" },
    { rank: 9, name: "Erik Lindgren", handle: "eriklindgren", score: 76, earned: "$2,800", country: "🇸🇪" },
    { rank: 10, name: "Liam O'Brien", handle: "liamobrien", score: 74, earned: "$2,400", country: "🇮🇪" },
];

export default function LeaderboardPage() {
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [period, setPeriod] = useState("alltime");

    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const isDark = theme === "dark";
    const cardBg = isDark ? "glass" : "bg-white border border-[#E5E2DC] shadow-sm";
    const mutedText = isDark ? "text-[#94A3B8]" : "text-[#6B7280]";
    const data = period === "alltime" ? leaderboardData : monthlyData;
    const top3 = data.slice(0, 3);
    const rest = data.slice(3);

    const podiumOrder = [top3[1], top3[0], top3[2]]; // 2nd, 1st, 3rd
    const podiumHeights = [140, 180, 110];
    const podiumColors = ["#C0C0C0", "#FFD700", "#CD7F32"];
    const podiumLabels = ["2nd", "1st", "3rd"];

    return (
        <>
            <TopBar title="Leaderboard" />
            <div className="p-4 lg:p-6 animate-fade-in-up">
                {/* Period Toggle */}
                <div className="flex items-center gap-2 mb-8">
                    {[
                        { key: "alltime", label: "All Time" },
                        { key: "monthly", label: "This Month" },
                    ].map((p) => (
                        <button
                            key={p.key}
                            id={`leaderboard-${p.key}`}
                            onClick={() => setPeriod(p.key)}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 cursor-pointer ${period === p.key
                                    ? "bg-[#00E5CC] text-[#0A0F1E]"
                                    : isDark
                                        ? "bg-[#1A2235] text-[#94A3B8] hover:bg-[#232D42]"
                                        : "bg-[#F0EEEB] text-[#6B7280] hover:bg-[#E5E2DC]"
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Podium */}
                <div className={`rounded-2xl p-6 sm:p-8 mb-8 ${cardBg}`}>
                    <div className="flex items-end justify-center gap-4 sm:gap-8">
                        {podiumOrder.map((person, i) => (
                            <div key={person.handle} className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: `${i * 150}ms` }}>
                                {/* Avatar */}
                                <div
                                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg font-bold font-matter mb-3 border-2 ${i === 1 ? "border-[#FFD700] shadow-lg shadow-[#FFD700]/20" : "border-[#334155]"
                                        }`}
                                    style={{
                                        background: isDark
                                            ? "linear-gradient(135deg, #1A2235, #0D1321)"
                                            : "linear-gradient(135deg, #F0EEEB, #E5E2DC)",
                                    }}
                                >
                                    {person.name.split(" ").map(n => n[0]).join("")}
                                </div>
                                <p className="text-sm font-bold mb-0.5 text-center">{person.name}</p>
                                <p className={`text-xs mb-2 ${mutedText}`}>@{person.handle}</p>
                                <p className="text-sm font-bold text-[#00E5CC] font-matter mb-3">{person.earned}</p>

                                {/* Podium bar */}
                                <div
                                    className="w-20 sm:w-28 rounded-t-xl flex flex-col items-center justify-start pt-4 transition-all duration-500"
                                    style={{
                                        height: `${podiumHeights[i]}px`,
                                        background: isDark
                                            ? `linear-gradient(180deg, ${podiumColors[i]}22, ${podiumColors[i]}08)`
                                            : `linear-gradient(180deg, ${podiumColors[i]}33, ${podiumColors[i]}11)`,
                                        border: `1px solid ${podiumColors[i]}33`,
                                    }}
                                >
                                    <span
                                        className="text-2xl font-bold font-matter"
                                        style={{ color: podiumColors[i] }}
                                    >
                                        {podiumLabels[i]}
                                    </span>
                                    <span className="text-xs mt-1 font-matter" style={{ color: podiumColors[i] }}>
                                        Score: {person.score}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ranked Table */}
                <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className={isDark ? "bg-[#0D1321]" : "bg-[#F5F3F0]"}>
                                    <th className={`px-4 py-3 text-left text-xs font-bold ${mutedText}`}>Rank</th>
                                    <th className={`px-4 py-3 text-left text-xs font-bold ${mutedText}`}>Contributor</th>
                                    <th className={`px-4 py-3 text-left text-xs font-bold ${mutedText}`}>Value Score</th>
                                    <th className={`px-4 py-3 text-left text-xs font-bold ${mutedText}`}>Total Earned</th>
                                    <th className={`px-4 py-3 text-left text-xs font-bold ${mutedText}`}>Country</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rest.map((person) => (
                                    <tr
                                        key={person.handle}
                                        className={`border-t transition-colors ${isDark ? "border-[#1E293B] hover:bg-[#1A2235]" : "border-[#F0EEEB] hover:bg-[#F5F3F0]"
                                            }`}
                                    >
                                        <td className="px-4 py-3.5">
                                            <span className="text-sm font-bold font-matter text-[#00E5CC]">#{person.rank}</span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-matter ${isDark ? "bg-[#1A2235]" : "bg-[#F5F3F0]"
                                                        }`}
                                                >
                                                    {person.name.split(" ").map(n => n[0]).join("")}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{person.name}</p>
                                                    <p className={`text-xs ${mutedText}`}>@{person.handle}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold font-matter">{person.score}</span>
                                                <div className={`w-16 h-1.5 rounded-full ${isDark ? "bg-[#1E293B]" : "bg-[#E5E2DC]"}`}>
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-[#00E5CC] to-[#00B4D8]"
                                                        style={{ width: `${person.score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-sm font-bold font-matter">{person.earned}</td>
                                        <td className="px-4 py-3.5 text-lg">{person.country}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
