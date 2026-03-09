"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import { IconGithub, IconKinetic, IconCheck } from "../components/Icons";

export default function AuthPage() {
    const { theme } = useTheme();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [loggedIn, setLoggedIn] = useState(false);
    const [showDID, setShowDID] = useState(false);

    useEffect(() => setMounted(true), []);

    const handleLogin = () => {
        // Redirect to the backend OAuth route
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        window.location.href = `${apiUrl}/api/auth/github`;
    };

    if (!mounted) return null;

    const isDark = theme === "dark";
    const mutedText = isDark ? "text-[#94A3B8]" : "text-[#6B7280]";

    return (
        <div className="min-h-screen flex flex-col">
            {/* Topbar */}
            <nav className={`flex items-center justify-between px-6 h-16 border-b transition-theme ${isDark ? "border-[#1E293B]" : "border-[#E5E2DC]"}`}>
                <Link href="/" className="flex items-center gap-2.5">
                    <IconKinetic className="w-7 h-7" />
                    <span className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Kinetic</span>
                </Link>
                <ThemeToggle />
            </nav>

            {/* Main */}
            <div className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md">
                    {/* Login Card */}
                    <div
                        className={`relative rounded-2xl p-8 animate-scale-in ${isDark ? "glass" : "bg-white border border-[#E5E2DC] shadow-xl"
                            } ${!loggedIn ? "glow-border" : "border-2 border-[#00E5CC]"}`}
                    >
                        {!loggedIn ? (
                            <>
                                <div className="text-center mb-8">
                                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#00E5CC]/10 mb-4">
                                        <IconKinetic className="w-8 h-8" />
                                    </div>
                                    <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                                        Welcome to Kinetic
                                    </h1>
                                    <p className={`text-sm ${mutedText}`}>
                                        Connect your GitHub to start earning rewards for your open-source contributions.
                                    </p>
                                </div>

                                <button
                                    id="github-login-btn"
                                    onClick={handleLogin}
                                    className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-[#00E5CC] text-[#0A0F1E] font-bold rounded-xl hover:bg-[#00D4BD] transition-all duration-200 hover:shadow-lg hover:shadow-[#00E5CC]/20 cursor-pointer"
                                >
                                    <IconGithub className="w-5 h-5" />
                                    Continue with GitHub
                                </button>

                                <div className={`mt-6 text-center text-xs ${mutedText}`}>
                                    By signing in, you agree to Kinetic&apos;s Terms of Service and Privacy Policy.
                                </div>
                            </>
                        ) : (
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#00E5CC]/20 mb-4 animate-scale-in">
                                    <IconCheck className="w-8 h-8 text-[#00E5CC]" />
                                </div>
                                <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                                    Authenticated Successfully
                                </h2>
                                <p className={`text-sm ${mutedText} mb-4`}>
                                    Your GitHub identity has been verified.
                                </p>

                                {/* DID Badge */}
                                {showDID && (
                                    <div className={`mt-6 rounded-xl p-4 animate-fade-in-up ${isDark ? "bg-[#0A0F1E] border border-[#1E293B]" : "bg-[#F5F3F0] border border-[#E5E2DC]"}`}>
                                        <div className="flex items-center justify-center gap-2 mb-3">
                                            <div className="w-2 h-2 rounded-full bg-[#00E5CC] animate-pulse" />
                                            <span className="text-xs font-bold text-[#00E5CC] font-matter tracking-widest uppercase">DID Issued</span>
                                        </div>
                                        <div
                                            className={`text-xs rounded-lg p-3 break-all text-left ${isDark ? "bg-[#1A2235] text-[#94A3B8]" : "bg-white text-[#6B7280] border border-[#E5E2DC]"
                                                }`}
                                            style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                            did:kinetic:flow:0x7a4b...e9f2:devnet
                                        </div>
                                        <p className={`text-xs mt-3 ${mutedText}`}>
                                            Redirecting to your dashboard...
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* DID Explainer */}
                    <div className={`mt-8 rounded-2xl p-6 animate-fade-in-up ${isDark ? "glass" : "bg-white border border-[#E5E2DC] shadow-sm"}`} style={{ animationDelay: "200ms" }}>
                        <h3 className="text-sm font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>
                            What is a Decentralized Identifier?
                        </h3>
                        <p className={`text-sm leading-relaxed ${mutedText}`}>
                            A <span className="text-[#00E5CC] font-medium">DID</span> is a globally unique, self-sovereign identity that you own — not any company. Your Kinetic DID links your GitHub contributions to an on-chain identity on the Flow blockchain, ensuring your Value Score and payout history are permanent, portable, and tamper-proof. It&apos;s your developer passport to decentralized funding.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
