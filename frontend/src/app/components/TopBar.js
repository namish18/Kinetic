"use client";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "./ThemeToggle";
import { IconBell } from "./Icons";

export default function TopBar({ title }) {
    const { theme } = useTheme();

    const bg = theme === "dark" ? "bg-[#0D1321]/80" : "bg-[#FAF8F5]/80";
    const border = theme === "dark" ? "border-[#1E293B]" : "border-[#E5E2DC]";
    const mutedText = theme === "dark" ? "text-[#94A3B8]" : "text-[#6B7280]";

    return (
        <header
            className={`sticky top-0 z-20 ${bg} backdrop-blur-lg border-b ${border} transition-theme`}
        >
            <div className="flex items-center justify-between px-4 lg:px-6 h-16">
                <h1
                    className="text-lg lg:text-xl font-bold tracking-tight pl-12 lg:pl-0"
                    style={{ fontFamily: "var(--font-heading)" }}
                >
                    {title}
                </h1>

                <div className="flex items-center gap-4">
                    <ThemeToggle />

                    {/* Notification Bell */}
                    <button
                        id="notification-bell"
                        className={`relative p-2 rounded-lg transition-all duration-200 cursor-pointer ${theme === "dark" ? "hover:bg-[#1A2235]" : "hover:bg-[#F0EEEB]"
                            }`}
                    >
                        <IconBell className={`w-5 h-5 ${mutedText}`} />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#00E5CC] rounded-full" />
                    </button>

                    {/* User Avatar */}
                    <div
                        className="w-8 h-8 rounded-full overflow-hidden border-2 border-[#00E5CC]/30 cursor-pointer hover:border-[#00E5CC] transition-all duration-200"
                    >
                        <div
                            className="w-full h-full flex items-center justify-center text-xs font-bold"
                            style={{
                                background: theme === "dark"
                                    ? "linear-gradient(135deg, #1A2235, #0D1321)"
                                    : "linear-gradient(135deg, #F0EEEB, #E5E2DC)",
                                fontFamily: "var(--font-mono)",
                            }}
                        >
                            SP
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
