"use client";
import { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import TopBar from "../../components/TopBar";

const didDocument = `{
  "@context": "https://www.w3.org/ns/did/v1",
  "id": "did:kinetic:flow:0x7a4b2c8d1e3f5a6b",
  "authentication": [{
    "id": "did:kinetic:flow:0x7a4b2c8d1e3f5a6b#keys-1",
    "type": "Ed25519VerificationKey2020",
    "controller": "did:kinetic:flow:0x7a4b2c8d1e3f5a6b",
    "publicKeyMultibase": "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"
  }],
  "service": [{
    "id": "did:kinetic:flow:0x7a4b2c8d1e3f5a6b#github",
    "type": "GitHubVerification",
    "serviceEndpoint": "https://github.com/sarahdev"
  }],
  "created": "2026-01-15T09:30:00Z",
  "updated": "2026-03-09T12:00:00Z"
}`;

export default function SettingsPage() {
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [notifications, setNotifications] = useState({
        bountyAlerts: true,
        weeklyDigest: true,
        voteReminders: false,
        projectUpdates: true,
        securityAlerts: true,
    });

    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const isDark = theme === "dark";
    const cardBg = isDark ? "glass" : "bg-white border border-[#E5E2DC] shadow-sm";
    const mutedText = isDark ? "text-[#94A3B8]" : "text-[#6B7280]";
    const sectionBorder = isDark ? "border-[#1E293B]" : "border-[#E5E2DC]";

    const Toggle = ({ checked, onChange }) => (
        <button
            onClick={onChange}
            className={`relative w-11 h-6 rounded-full transition-all duration-200 cursor-pointer ${checked ? "bg-[#00E5CC]" : isDark ? "bg-[#1E293B]" : "bg-[#D1D5DB]"
                }`}
        >
            <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${checked ? "left-[22px]" : "left-0.5"
                    }`}
            />
        </button>
    );

    return (
        <>
            <TopBar title="Settings" />
            <div className="p-4 lg:p-6 animate-fade-in-up max-w-3xl">
                {/* Profile Section */}
                <section className={`rounded-2xl p-6 mb-6 ${cardBg}`}>
                    <h2 className="text-lg font-bold mb-6" style={{ fontFamily: "var(--font-heading)" }}>
                        Profile
                    </h2>
                    <div className="flex items-start gap-4 mb-6">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold font-matter border-2 border-[#00E5CC]/30 flex-shrink-0"
                            style={{
                                background: isDark
                                    ? "linear-gradient(135deg, #1A2235, #0D1321)"
                                    : "linear-gradient(135deg, #F0EEEB, #E5E2DC)",
                            }}
                        >
                            SP
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Sarah Park</h3>
                            <p className={`text-sm ${mutedText}`}>@sarahdev</p>
                            <p className={`text-xs mt-1 ${mutedText}`}>Connected via GitHub since Jan 2026</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className={`text-sm font-medium ${mutedText} block mb-1.5`}>Email</label>
                            <input
                                type="email"
                                defaultValue="sarah@example.dev"
                                className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none ${isDark
                                        ? "bg-[#1A2235] border border-[#1E293B] focus:border-[#00E5CC] text-white"
                                        : "bg-[#F5F3F0] border border-[#E5E2DC] focus:border-[#00E5CC]"
                                    }`}
                            />
                        </div>
                        <div>
                            <label className={`text-sm font-medium ${mutedText} block mb-1.5`}>Payout Wallet Address</label>
                            <input
                                type="text"
                                defaultValue="0x7a4b2c8d1e3f5a6b9c0d4e8f7a2b3c5d"
                                className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none ${isDark
                                        ? "bg-[#1A2235] border border-[#1E293B] focus:border-[#00E5CC] text-white"
                                        : "bg-[#F5F3F0] border border-[#E5E2DC] focus:border-[#00E5CC]"
                                    }`}
                                style={{ fontFamily: "var(--font-mono)" }}
                            />
                        </div>
                        <button className="px-5 py-2 bg-[#00E5CC] text-[#0A0F1E] font-bold text-sm rounded-xl hover:bg-[#00D4BD] transition-all cursor-pointer">
                            Save Changes
                        </button>
                    </div>
                </section>

                {/* Notifications */}
                <section className={`rounded-2xl p-6 mb-6 ${cardBg}`}>
                    <h2 className="text-lg font-bold mb-6" style={{ fontFamily: "var(--font-heading)" }}>
                        Notifications
                    </h2>
                    <div className="space-y-4">
                        {[
                            { key: "bountyAlerts", label: "Bounty Alerts", desc: "Get notified when a bounty is ready to claim" },
                            { key: "weeklyDigest", label: "Weekly Digest", desc: "Summary of your contributions and earnings" },
                            { key: "voteReminders", label: "Vote Reminders", desc: "Reminders when new voting rounds open" },
                            { key: "projectUpdates", label: "Project Updates", desc: "Updates from projects you contribute to" },
                            { key: "securityAlerts", label: "Security Alerts", desc: "Critical security notifications for your account" },
                        ].map((item) => (
                            <div key={item.key} className={`flex items-center justify-between py-3 border-b last:border-0 ${sectionBorder}`}>
                                <div>
                                    <p className="text-sm font-medium">{item.label}</p>
                                    <p className={`text-xs ${mutedText}`}>{item.desc}</p>
                                </div>
                                <Toggle
                                    checked={notifications[item.key]}
                                    onChange={() =>
                                        setNotifications((n) => ({ ...n, [item.key]: !n[item.key] }))
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </section>

                {/* Identity — DID Document */}
                <section className={`rounded-2xl p-6 mb-6 ${cardBg}`}>
                    <h2 className="text-lg font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                        Identity
                    </h2>
                    <p className={`text-sm ${mutedText} mb-4`}>
                        Your Decentralized Identifier (DID) document anchored on Flow blockchain.
                    </p>
                    <div className={`rounded-xl p-4 overflow-x-auto ${isDark ? "bg-[#0A0F1E] border border-[#1E293B]" : "bg-[#F5F3F0] border border-[#E5E2DC]"}`}>
                        <pre className={`text-xs leading-relaxed whitespace-pre ${isDark ? "text-[#94A3B8]" : "text-[#6B7280]"}`} style={{ fontFamily: "var(--font-mono)" }}>
                            {didDocument}
                        </pre>
                    </div>
                </section>

                {/* Danger Zone */}
                <section className="rounded-2xl p-6 border-2 border-red-500/30 mb-6">
                    <h2 className="text-lg font-bold text-red-400 mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                        Danger Zone
                    </h2>
                    <p className={`text-sm ${mutedText} mb-4`}>
                        Irreversible actions that affect your account and wallet connection.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button className="px-5 py-2.5 border border-red-500/40 text-red-400 font-bold text-sm rounded-xl hover:bg-red-500/10 transition-all cursor-pointer">
                            Disconnect Wallet
                        </button>
                        <button className="px-5 py-2.5 border border-red-500/40 text-red-400 font-bold text-sm rounded-xl hover:bg-red-500/10 transition-all cursor-pointer">
                            Delete Account
                        </button>
                    </div>
                </section>
            </div>
        </>
    );
}
