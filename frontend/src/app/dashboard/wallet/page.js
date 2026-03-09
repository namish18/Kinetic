"use client";
import { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import TopBar from "../../components/TopBar";
import { IconWallet, IconWithdraw, IconClose, IconCheck } from "../../components/Icons";

const transactions = [
    { date: "Mar 8, 2026", project: "vercel/next.js", amount: "+340 FLOW", status: "Completed" },
    { date: "Mar 6, 2026", project: "prisma/prisma", amount: "+120 FLOW", status: "Completed" },
    { date: "Mar 3, 2026", project: "tailwindlabs/tailwindcss", amount: "+580 FLOW", status: "Completed" },
    { date: "Feb 28, 2026", project: "drizzle-team/drizzle-orm", amount: "+215 FLOW", status: "Pending" },
    { date: "Feb 25, 2026", project: "trpc/trpc", amount: "+85 FLOW", status: "Completed" },
    { date: "Feb 20, 2026", project: "Withdrawal", amount: "-2,000 FLOW", status: "Completed" },
    { date: "Feb 18, 2026", project: "withastro/astro", amount: "+320 FLOW", status: "Completed" },
    { date: "Feb 15, 2026", project: "shadcn-ui/ui", amount: "+410 FLOW", status: "Completed" },
];

const payoutSchedule = [
    { date: "Mar 15, 2026", label: "Monthly Payout Distribution", status: "upcoming" },
    { date: "Mar 1, 2026", label: "Q1 Bonus Round", status: "completed" },
    { date: "Feb 15, 2026", label: "Monthly Payout Distribution", status: "completed" },
    { date: "Feb 1, 2026", label: "Retroactive Grants Release", status: "completed" },
];

export default function WalletPage() {
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [withdrawStep, setWithdrawStep] = useState(1);
    const [walletAddress, setWalletAddress] = useState("");

    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const isDark = theme === "dark";
    const cardBg = isDark ? "glass" : "bg-white border border-[#E5E2DC] shadow-sm";
    const mutedText = isDark ? "text-[#94A3B8]" : "text-[#6B7280]";

    const handleWithdraw = () => {
        if (withdrawStep === 1 && walletAddress.length > 5) {
            setWithdrawStep(2);
        } else if (withdrawStep === 2) {
            setWithdrawStep(3);
            setTimeout(() => {
                setShowModal(false);
                setWithdrawStep(1);
                setWalletAddress("");
            }, 2000);
        }
    };

    return (
        <>
            <TopBar title="Wallet & Payouts" />
            <div className="p-4 lg:p-6 animate-fade-in-up">
                {/* Wallet Card */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div
                        className={`lg:col-span-2 rounded-2xl p-6 relative overflow-hidden ${cardBg} glow-card`}
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 -translate-y-1/2 translate-x-1/2"
                            style={{ background: "radial-gradient(circle, #00E5CC, transparent 70%)" }}
                        />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <IconWallet className="w-5 h-5 text-[#00E5CC]" />
                                <span className={`text-sm font-medium ${mutedText}`}>Flow Blockchain Wallet</span>
                            </div>
                            <div className="mb-2">
                                <span className={`text-xs ${mutedText}`}>Available Balance</span>
                            </div>
                            <p className="text-4xl sm:text-5xl font-bold font-matter mb-1">
                                4,270 <span className="text-xl text-[#00E5CC]">FLOW</span>
                            </p>
                            <p className={`text-sm ${mutedText} mb-6`}>≈ $3,416.00 USD</p>

                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    id="withdraw-btn"
                                    onClick={() => setShowModal(true)}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#00E5CC] text-[#0A0F1E] font-bold text-sm rounded-xl hover:bg-[#00D4BD] transition-all duration-200 cursor-pointer"
                                >
                                    <IconWithdraw className="w-4 h-4" />
                                    Withdraw
                                </button>
                                <div className={`text-xs ${mutedText} px-4 py-2 rounded-lg ${isDark ? "bg-[#1A2235]" : "bg-[#F5F3F0]"}`}
                                    style={{ fontFamily: "var(--font-mono)" }}>
                                    0x7a4b...e9f2
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="space-y-4">
                        {[
                            { label: "Total Earned (All Time)", value: "12,450 FLOW", usd: "≈ $9,960" },
                            { label: "Pending Payouts", value: "215 FLOW", usd: "≈ $172" },
                            { label: "Last Withdrawal", value: "2,000 FLOW", usd: "Feb 20, 2026" },
                        ].map((s) => (
                            <div key={s.label} className={`rounded-xl p-4 ${cardBg}`}>
                                <p className={`text-xs ${mutedText} mb-1`}>{s.label}</p>
                                <p className="text-lg font-bold font-matter">{s.value}</p>
                                <p className={`text-xs ${mutedText}`}>{s.usd}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Transaction History */}
                    <div className={`lg:col-span-2 rounded-2xl overflow-hidden ${cardBg}`}>
                        <div className="p-4 border-b" style={{ borderColor: isDark ? "#1E293B" : "#E5E2DC" }}>
                            <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                                Transaction History
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className={isDark ? "bg-[#0D1321]" : "bg-[#F5F3F0]"}>
                                        <th className={`px-4 py-2.5 text-left text-xs font-bold ${mutedText}`}>Date</th>
                                        <th className={`px-4 py-2.5 text-left text-xs font-bold ${mutedText}`}>Project</th>
                                        <th className={`px-4 py-2.5 text-left text-xs font-bold ${mutedText}`}>Amount</th>
                                        <th className={`px-4 py-2.5 text-left text-xs font-bold ${mutedText}`}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx, i) => (
                                        <tr
                                            key={i}
                                            className={`border-t transition-colors ${isDark ? "border-[#1E293B] hover:bg-[#1A2235]" : "border-[#F0EEEB] hover:bg-[#F5F3F0]"
                                                }`}
                                        >
                                            <td className={`px-4 py-3 text-sm ${mutedText}`} style={{ fontFamily: "var(--font-mono)" }}>
                                                {tx.date}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium">{tx.project}</td>
                                            <td className={`px-4 py-3 text-sm font-bold font-matter ${tx.amount.startsWith("-") ? "text-red-400" : "text-[#00E5CC]"
                                                }`}>
                                                {tx.amount}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${tx.status === "Completed"
                                                        ? "bg-[#00E5CC]/10 text-[#00E5CC]"
                                                        : "bg-yellow-500/10 text-yellow-500"
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${tx.status === "Completed" ? "bg-[#00E5CC]" : "bg-yellow-500 animate-pulse"
                                                        }`} />
                                                    {tx.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Payout Schedule */}
                    <div className={`rounded-2xl p-6 ${cardBg}`}>
                        <h3 className="text-sm font-bold mb-6" style={{ fontFamily: "var(--font-heading)" }}>
                            Payout Schedule
                        </h3>
                        <div className="space-y-6">
                            {payoutSchedule.map((item, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.status === "upcoming"
                                                ? "bg-[#00E5CC] shadow-lg shadow-[#00E5CC]/30"
                                                : isDark ? "bg-[#334155]" : "bg-[#D1D5DB]"
                                            }`} />
                                        {i < payoutSchedule.length - 1 && (
                                            <div className={`w-0.5 flex-1 mt-1 ${isDark ? "bg-[#1E293B]" : "bg-[#E5E2DC]"}`} />
                                        )}
                                    </div>
                                    <div className="pb-4">
                                        <p className={`text-xs font-matter ${item.status === "upcoming" ? "text-[#00E5CC]" : mutedText}`}>
                                            {item.date}
                                        </p>
                                        <p className={`text-sm font-medium mt-0.5 ${item.status === "upcoming" ? "" : mutedText}`}>
                                            {item.label}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Withdraw Modal */}
                {showModal && (
                    <>
                        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => { setShowModal(false); setWithdrawStep(1); setWalletAddress(""); }} />
                        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                            <div className={`w-full max-w-md rounded-2xl p-6 animate-scale-in ${isDark ? "bg-[#0D1321] border border-[#1E293B]" : "bg-white border border-[#E5E2DC] shadow-2xl"
                                }`}>
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                                        {withdrawStep === 3 ? "Withdrawal Submitted" : "Withdraw FLOW"}
                                    </h3>
                                    <button onClick={() => { setShowModal(false); setWithdrawStep(1); setWalletAddress(""); }} className="cursor-pointer">
                                        <IconClose className={`w-5 h-5 ${mutedText}`} />
                                    </button>
                                </div>

                                {withdrawStep === 1 && (
                                    <div>
                                        <label className={`text-sm font-medium ${mutedText} block mb-2`}>Wallet Address</label>
                                        <input
                                            id="withdraw-wallet-input"
                                            type="text"
                                            placeholder="0x..."
                                            value={walletAddress}
                                            onChange={(e) => setWalletAddress(e.target.value)}
                                            className={`w-full px-4 py-3 rounded-xl text-sm outline-none mb-4 ${isDark
                                                    ? "bg-[#1A2235] border border-[#1E293B] focus:border-[#00E5CC] text-white"
                                                    : "bg-[#F5F3F0] border border-[#E5E2DC] focus:border-[#00E5CC]"
                                                }`}
                                            style={{ fontFamily: "var(--font-mono)" }}
                                        />
                                        <label className={`text-sm font-medium ${mutedText} block mb-2`}>Amount</label>
                                        <div className={`px-4 py-3 rounded-xl text-sm mb-6 ${isDark ? "bg-[#1A2235]" : "bg-[#F5F3F0]"}`}>
                                            <span className="font-bold font-matter">4,270 FLOW</span>
                                            <span className={`text-xs ml-2 ${mutedText}`}>(Max)</span>
                                        </div>
                                        <button
                                            onClick={handleWithdraw}
                                            disabled={walletAddress.length <= 5}
                                            className={`w-full py-3 font-bold rounded-xl transition-all cursor-pointer ${walletAddress.length > 5
                                                    ? "bg-[#00E5CC] text-[#0A0F1E] hover:bg-[#00D4BD]"
                                                    : "bg-gray-500/30 text-gray-500 cursor-not-allowed"
                                                }`}
                                        >
                                            Continue
                                        </button>
                                    </div>
                                )}

                                {withdrawStep === 2 && (
                                    <div>
                                        <div className={`rounded-xl p-4 mb-6 ${isDark ? "bg-[#1A2235]" : "bg-[#F5F3F0]"}`}>
                                            <div className="flex justify-between mb-2">
                                                <span className={`text-sm ${mutedText}`}>To:</span>
                                                <span className="text-sm font-matter">{walletAddress.slice(0, 10)}...{walletAddress.slice(-4)}</span>
                                            </div>
                                            <div className="flex justify-between mb-2">
                                                <span className={`text-sm ${mutedText}`}>Amount:</span>
                                                <span className="text-sm font-bold font-matter">4,270 FLOW</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className={`text-sm ${mutedText}`}>Network Fee:</span>
                                                <span className="text-sm font-matter">~0.001 FLOW</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleWithdraw}
                                            className="w-full py-3 bg-[#00E5CC] text-[#0A0F1E] font-bold rounded-xl hover:bg-[#00D4BD] transition-all cursor-pointer"
                                        >
                                            Confirm Withdrawal
                                        </button>
                                    </div>
                                )}

                                {withdrawStep === 3 && (
                                    <div className="text-center py-4 animate-scale-in">
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#00E5CC]/20 mb-4">
                                            <IconCheck className="w-8 h-8 text-[#00E5CC]" />
                                        </div>
                                        <p className="text-sm font-medium">Transaction submitted to Flow mainnet</p>
                                        <p className={`text-xs mt-2 ${mutedText}`}>You will be notified once confirmed.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
