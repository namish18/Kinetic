"use client";
import { useTheme } from "../context/ThemeContext";
import { IconSun, IconMoon } from "./Icons";

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            id="theme-toggle"
            onClick={toggleTheme}
            className="relative w-14 h-7 rounded-full transition-all duration-300 cursor-pointer group"
            style={{
                background: theme === "dark"
                    ? "linear-gradient(135deg, #1E293B, #0F172A)"
                    : "linear-gradient(135deg, #FDE68A, #FCD34D)",
                border: `1px solid ${theme === "dark" ? "#334155" : "#F59E0B"}`,
            }}
            aria-label="Toggle theme"
        >
            <div
                className="absolute top-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 shadow-md"
                style={{
                    left: theme === "dark" ? "2px" : "28px",
                    background: theme === "dark" ? "#0F172A" : "#FFFBEB",
                }}
            >
                {theme === "dark" ? (
                    <IconMoon className="w-3.5 h-3.5 text-[#00E5CC]" />
                ) : (
                    <IconSun className="w-3.5 h-3.5 text-[#F59E0B]" />
                )}
            </div>
        </button>
    );
}
