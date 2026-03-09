"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../context/ThemeContext";
import {
    IconOverview,
    IconContributions,
    IconLeaderboard,
    IconVote,
    IconWallet,
    IconSettings,
    IconRegistry,
    IconMenu,
    IconClose,
    IconKinetic,
} from "./Icons";

const navItems = [
    { label: "Overview", href: "/dashboard", icon: IconOverview },
    { label: "My Contributions", href: "/dashboard/contributions", icon: IconContributions },
    { label: "Leaderboard", href: "/dashboard/leaderboard", icon: IconLeaderboard },
    { label: "Vote", href: "/dashboard/vote", icon: IconVote },
    { label: "Wallet", href: "/dashboard/wallet", icon: IconWallet },
    { label: "Registry", href: "/dashboard/registry", icon: IconRegistry },
    { label: "Settings", href: "/dashboard/settings", icon: IconSettings },
];

export default function Sidebar() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const { theme } = useTheme();

    const isActive = (href) => pathname === href;

    const bg = theme === "dark" ? "bg-[#0D1321]" : "bg-white";
    const border = theme === "dark" ? "border-[#1E293B]" : "border-[#E5E2DC]";
    const hoverBg = theme === "dark" ? "hover:bg-[#1A2235]" : "hover:bg-[#F5F3F0]";
    const activeBg = theme === "dark" ? "bg-[#1A2235]" : "bg-[#F0EEEB]";
    const mutedText = theme === "dark" ? "text-[#94A3B8]" : "text-[#6B7280]";

    const nav = (
        <nav className="flex flex-col gap-1 px-3 mt-4">
            {navItems.map(({ label, href, icon: Icon }) => (
                <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive(href)
                            ? `${activeBg} text-[#00E5CC]`
                            : `${mutedText} ${hoverBg}`
                        }`}
                >
                    <Icon className={`w-[18px] h-[18px] ${isActive(href) ? "text-[#00E5CC]" : ""}`} />
                    <span>{label}</span>
                    {isActive(href) && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00E5CC]" />
                    )}
                </Link>
            ))}
        </nav>
    );

    return (
        <>
            {/* Mobile hamburger */}
            <button
                id="sidebar-toggle"
                onClick={() => setOpen(true)}
                className={`lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg transition-theme ${bg} border ${border} cursor-pointer`}
            >
                <IconMenu className={theme === "dark" ? "text-white" : "text-gray-900"} />
            </button>

            {/* Mobile overlay */}
            {open && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Mobile sidebar */}
            <aside
                className={`lg:hidden fixed top-0 left-0 h-full w-64 z-50 ${bg} border-r ${border} transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: theme === "dark" ? "#1E293B" : "#E5E2DC" }}>
                    <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
                        <IconKinetic className="w-8 h-8" />
                        <span className="font-heading text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>Kinetic</span>
                    </Link>
                    <button onClick={() => setOpen(false)} className="cursor-pointer">
                        <IconClose className={theme === "dark" ? "text-white" : "text-gray-900"} />
                    </button>
                </div>
                {nav}
            </aside>

            {/* Desktop sidebar */}
            <aside
                className={`hidden lg:flex lg:flex-col lg:fixed lg:top-0 lg:left-0 lg:h-screen lg:w-60 ${bg} border-r ${border} z-30`}
            >
                <div className="p-5 border-b" style={{ borderColor: theme === "dark" ? "#1E293B" : "#E5E2DC" }}>
                    <Link href="/" className="flex items-center gap-2.5">
                        <IconKinetic className="w-8 h-8" />
                        <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>Kinetic</span>
                    </Link>
                </div>
                {nav}
                <div className="mt-auto p-4 border-t" style={{ borderColor: theme === "dark" ? "#1E293B" : "#E5E2DC" }}>
                    <div className={`text-xs ${mutedText}`}>
                        <p className="font-matter">v1.0.0 — Devnet</p>
                        <p className="mt-1">Powered by Flow Blockchain</p>
                    </div>
                </div>
            </aside>
        </>
    );
}
