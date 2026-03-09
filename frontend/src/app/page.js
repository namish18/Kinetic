"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";
import { IconKinetic, IconGithub, IconArrowRight } from "./components/Icons";

const tickerData = [
  { user: "alexchen", project: "react-query", amount: "2,450" },
  { user: "sveltejs", project: "svelte", amount: "8,120" },
  { user: "denoland", project: "deno", amount: "5,300" },
  { user: "withastro", project: "astro", amount: "3,780" },
  { user: "vercel", project: "next.js", amount: "12,600" },
  { user: "tailwindlabs", project: "tailwindcss", amount: "6,900" },
  { user: "drizzle-team", project: "drizzle-orm", amount: "4,210" },
  { user: "jaredpalmer", project: "formik", amount: "1,850" },
  { user: "trpc", project: "trpc", amount: "7,420" },
  { user: "prisma", project: "prisma", amount: "9,100" },
];

const steps = [
  {
    num: "01",
    title: "Login with GitHub",
    desc: "Authenticate with your GitHub account to link your open-source contributions securely.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-[#00E5CC]">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Get DID Identity",
    desc: "Receive a Decentralized Identifier anchored on-chain — your portable, self-sovereign developer identity.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00E5CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Algorithm Scores You",
    desc: "Our Contribution Value Algorithm analyzes your commits, dependencies, and downstream impact in real time.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00E5CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Get Paid",
    desc: "Claim FLOW token bounties automatically routed to your connected wallet based on your Value Score.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00E5CC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
];

const metrics = [
  { label: "Total Paid Out", value: "$2.4M", suffix: "+" },
  { label: "Projects Funded", value: "1,247", suffix: "" },
  { label: "Contributors Rewarded", value: "18,932", suffix: "" },
];

export default function LandingPage() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#1A2235]/60 border-[#1E293B]" : "bg-white border-[#E5E2DC]";
  const mutedText = isDark ? "text-[#94A3B8]" : "text-[#6B7280]";
  const sectionBg = isDark ? "bg-[#0D1321]" : "bg-[#F5F3F0]";

  return (
    <div className="min-h-screen">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b transition-theme ${isDark ? "bg-[#0A0F1E]/80 border-[#1E293B]" : "bg-[#FAF8F5]/80 border-[#E5E2DC]"
          }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <IconKinetic className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
              Kinetic
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className={`text-sm font-medium ${mutedText} hover:text-[#00E5CC] transition-colors`}>How It Works</a>
            <a href="#metrics" className={`text-sm font-medium ${mutedText} hover:text-[#00E5CC] transition-colors`}>Metrics</a>
            <Link href="/auth" className={`text-sm font-medium ${mutedText} hover:text-[#00E5CC] transition-colors`}>Login</Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/auth"
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#00E5CC] text-[#0A0F1E] text-sm font-bold rounded-lg hover:bg-[#00D4BD] transition-all duration-200 hover:shadow-lg hover:shadow-[#00E5CC]/20"
            >
              Get Started
              <IconArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ─────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full opacity-20 animated-gradient-slow"
            style={{
              background: isDark
                ? "radial-gradient(ellipse, rgba(0,229,204,0.15), transparent 70%)"
                : "radial-gradient(ellipse, rgba(0,229,204,0.08), transparent 70%)",
            }}
          />
          <div
            className="absolute top-40 right-10 w-3 h-3 rounded-full bg-[#00E5CC] animate-float"
            style={{ animationDelay: "0s" }}
          />
          <div
            className="absolute top-60 left-20 w-2 h-2 rounded-full bg-[#00E5CC]/60 animate-float"
            style={{ animationDelay: "1s" }}
          />
          <div
            className="absolute top-80 right-40 w-4 h-4 rounded-full bg-[#00E5CC]/30 animate-float"
            style={{ animationDelay: "2s" }}
          />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
            <div
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 ${isDark ? "bg-[#00E5CC]/10 text-[#00E5CC] border border-[#00E5CC]/20" : "bg-[#00E5CC]/10 text-[#00917F] border border-[#00E5CC]/20"
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E5CC] animate-pulse" />
              Decentralized Open-Source Funding
            </div>
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-7xl font-bold leading-tight mb-6 animate-fade-in-up"
            style={{ fontFamily: "var(--font-heading)", animationDelay: "100ms" }}
          >
            Fund the Code That{" "}
            <span className="text-transparent bg-clip-text animated-gradient" style={{
              backgroundImage: "linear-gradient(135deg, #00E5CC, #00B4D8, #00E5CC)"
            }}>
              Powers the World
            </span>
          </h1>

          <p
            className={`text-lg sm:text-xl max-w-2xl mx-auto mb-10 animate-fade-in-up ${mutedText}`}
            style={{ animationDelay: "200ms" }}
          >
            Kinetic uses algorithmic value scoring and quadratic voting to fairly distribute funding to the open-source developers who build the infrastructure we all depend on.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
            <Link
              href="/auth"
              className="flex items-center gap-2 px-8 py-3.5 bg-[#00E5CC] text-[#0A0F1E] font-bold rounded-xl hover:bg-[#00D4BD] transition-all duration-200 hover:shadow-xl hover:shadow-[#00E5CC]/25 hover:-translate-y-0.5"
            >
              <IconGithub className="w-5 h-5" />
              Start with GitHub
            </Link>
            <a
              href="#how-it-works"
              className={`flex items-center gap-2 px-8 py-3.5 font-bold rounded-xl border transition-all duration-200 hover:-translate-y-0.5 ${isDark
                  ? "border-[#1E293B] text-[#E2E8F0] hover:bg-[#1A2235]"
                  : "border-[#E5E2DC] text-[#1A1A2E] hover:bg-[#F0EEEB]"
                }`}
            >
              Learn More
              <IconArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Live Ticker ──────────────────────────────────────── */}
      <section className={`py-4 border-y overflow-hidden ${isDark ? "border-[#1E293B] bg-[#0D1321]" : "border-[#E5E2DC] bg-[#F5F3F0]"}`}>
        <div className="flex no-scrollbar">
          <div className="flex gap-12 ticker-scroll whitespace-nowrap">
            {[...tickerData, ...tickerData].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-[#00E5CC] animate-pulse" />
                <span className={`font-medium ${mutedText}`}>@{item.user}</span>
                <span className={isDark ? "text-[#334155]" : "text-[#D1D5DB]"}>·</span>
                <span className="font-medium">{item.project}</span>
                <span className="text-[#00E5CC] font-bold font-matter">${item.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2
              className="text-3xl sm:text-4xl font-bold mb-4"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              How It Works
            </h2>
            <p className={`text-lg max-w-xl mx-auto ${mutedText}`}>
              From your first commit to your first payout — in four simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger">
            {steps.map((step) => (
              <div
                key={step.num}
                className={`relative p-6 rounded-2xl border transition-all duration-300 hover-lift animate-fade-in-up ${isDark ? "glass" : "bg-white border-[#E5E2DC] shadow-sm"
                  }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[#00E5CC] text-xs font-bold font-matter tracking-widest">{step.num}</span>
                  {step.icon}
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                  {step.title}
                </h3>
                <p className={`text-sm leading-relaxed ${mutedText}`}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Metrics Strip ────────────────────────────────────── */}
      <section id="metrics" className={`py-16 px-4 sm:px-6 ${sectionBg}`}>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {metrics.map((m) => (
            <div key={m.label} className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-[#00E5CC] mb-2 font-matter">
                {m.value}{m.suffix}
              </div>
              <p className={`text-sm font-medium ${mutedText}`}>{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Section ──────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-3xl sm:text-4xl font-bold mb-6"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Join the Movement
          </h2>
          <p className={`text-lg mb-10 ${mutedText}`}>
            Thousands of open-source contributors are already earning what they deserve. Connect your GitHub and start building your Value Score today.
          </p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 px-10 py-4 bg-[#00E5CC] text-[#0A0F1E] font-bold text-lg rounded-xl hover:bg-[#00D4BD] transition-all duration-200 hover:shadow-xl hover:shadow-[#00E5CC]/25 hover:-translate-y-0.5"
          >
            <IconGithub className="w-5 h-5" />
            Get Started — It&apos;s Free
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className={`border-t py-12 px-4 sm:px-6 ${isDark ? "border-[#1E293B]" : "border-[#E5E2DC]"}`}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <IconKinetic className="w-6 h-6" />
                <span className="font-bold" style={{ fontFamily: "var(--font-heading)" }}>Kinetic</span>
              </div>
              <p className={`text-sm ${mutedText}`}>
                Decentralized funding for the open-source ecosystem.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3" style={{ fontFamily: "var(--font-heading)" }}>Platform</h4>
              <div className="flex flex-col gap-2">
                <Link href="/dashboard" className={`text-sm ${mutedText} hover:text-[#00E5CC] transition-colors`}>Dashboard</Link>
                <Link href="/dashboard/leaderboard" className={`text-sm ${mutedText} hover:text-[#00E5CC] transition-colors`}>Leaderboard</Link>
                <Link href="/dashboard/vote" className={`text-sm ${mutedText} hover:text-[#00E5CC] transition-colors`}>Voting</Link>
                <Link href="/dashboard/registry" className={`text-sm ${mutedText} hover:text-[#00E5CC] transition-colors`}>Registry</Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3" style={{ fontFamily: "var(--font-heading)" }}>Resources</h4>
              <div className="flex flex-col gap-2">
                <a href="#" className={`text-sm ${mutedText} hover:text-[#00E5CC] transition-colors`}>Documentation</a>
                <a href="#" className={`text-sm ${mutedText} hover:text-[#00E5CC] transition-colors`}>API Reference</a>
                <a href="#" className={`text-sm ${mutedText} hover:text-[#00E5CC] transition-colors`}>GitHub</a>
                <a href="#" className={`text-sm ${mutedText} hover:text-[#00E5CC] transition-colors`}>Blog</a>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3" style={{ fontFamily: "var(--font-heading)" }}>Legal</h4>
              <div className="flex flex-col gap-2">
                <a href="#" className={`text-sm ${mutedText} hover:text-[#00E5CC] transition-colors`}>Privacy Policy</a>
                <a href="#" className={`text-sm ${mutedText} hover:text-[#00E5CC] transition-colors`}>Terms of Service</a>
                <a href="#" className={`text-sm ${mutedText} hover:text-[#00E5CC] transition-colors`}>Cookie Policy</a>
              </div>
            </div>
          </div>
          <div className={`pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${isDark ? "border-[#1E293B]" : "border-[#E5E2DC]"}`}>
            <p className={`text-sm ${mutedText}`}>© 2026 Kinetic Protocol. All rights reserved.</p>
            <p className={`text-xs ${mutedText}`}>Built on Flow Blockchain</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
