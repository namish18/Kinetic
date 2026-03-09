"use client";
import { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import TopBar from "../../components/TopBar";
import { IconCheck, IconArrowRight } from "../../components/Icons";

const registeredProjects = [
    { name: "next.js", org: "vercel", score: 97, stars: "128k", lang: "TypeScript", status: "Verified" },
    { name: "prisma", org: "prisma", score: 91, stars: "42k", lang: "Rust", status: "Verified" },
    { name: "tailwindcss", org: "tailwindlabs", score: 94, stars: "85k", lang: "JavaScript", status: "Verified" },
    { name: "drizzle-orm", org: "drizzle-team", score: 82, stars: "28k", lang: "TypeScript", status: "Verified" },
    { name: "trpc", org: "trpc", score: 86, stars: "36k", lang: "TypeScript", status: "Pending" },
    { name: "astro", org: "withastro", score: 89, stars: "48k", lang: "JavaScript", status: "Verified" },
];

const stepLabels = ["Project Info", "GitHub Metrics", "Review", "Submit"];

export default function RegistryPage() {
    const { theme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [step, setStep] = useState(0);
    const [formData, setFormData] = useState({
        repoUrl: "",
        name: "",
        description: "",
        category: "infrastructure",
    });
    const [fakeMetrics, setFakeMetrics] = useState(null);

    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const isDark = theme === "dark";
    const cardBg = isDark ? "glass" : "bg-white border border-[#E5E2DC] shadow-sm";
    const mutedText = isDark ? "text-[#94A3B8]" : "text-[#6B7280]";

    const handleNext = () => {
        if (step === 0 && formData.repoUrl && formData.name) {
            // Fake API call
            setStep(1);
            setTimeout(() => {
                setFakeMetrics({
                    stars: "1,247",
                    forks: "189",
                    contributors: "34",
                    dependents: "2,100",
                    openIssues: "23",
                    lastCommit: "2 hours ago",
                });
            }, 1000);
        } else if (step === 1 && fakeMetrics) {
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 90) return "text-[#00E5CC]";
        if (score >= 80) return "text-[#00B4D8]";
        return "text-yellow-400";
    };

    return (
        <>
            <TopBar title="Project Registry" />
            <div className="p-4 lg:p-6 animate-fade-in-up">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <p className={`text-sm ${mutedText}`}>Register your open-source project to receive funding through Kinetic.</p>
                    </div>
                    {!showForm && (
                        <button
                            id="register-project-btn"
                            onClick={() => setShowForm(true)}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#00E5CC] text-[#0A0F1E] font-bold text-sm rounded-xl hover:bg-[#00D4BD] transition-all duration-200 cursor-pointer"
                        >
                            Register Project
                            <IconArrowRight className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Multi-Step Form */}
                {showForm && (
                    <div className={`rounded-2xl p-6 mb-8 animate-fade-in-up ${cardBg}`}>
                        {/* Stepper */}
                        <div className="flex items-center justify-between mb-8 overflow-x-auto">
                            {stepLabels.map((label, i) => (
                                <div key={label} className="flex items-center flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-matter flex-shrink-0 transition-all ${i <= step
                                                ? "bg-[#00E5CC] text-[#0A0F1E]"
                                                : isDark ? "bg-[#1E293B] text-[#475569]" : "bg-[#E5E2DC] text-[#9CA3AF]"
                                            }`}>
                                            {i < step ? <IconCheck className="w-4 h-4" /> : i + 1}
                                        </div>
                                        <span className={`text-xs font-medium whitespace-nowrap hidden sm:block ${i <= step ? "" : mutedText
                                            }`}>
                                            {label}
                                        </span>
                                    </div>
                                    {i < stepLabels.length - 1 && (
                                        <div className={`flex-1 h-0.5 mx-3 rounded ${i < step
                                                ? "bg-[#00E5CC]"
                                                : isDark ? "bg-[#1E293B]" : "bg-[#E5E2DC]"
                                            }`} />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Step 0: Project Info */}
                        {step === 0 && (
                            <div className="max-w-lg mx-auto space-y-4 animate-fade-in">
                                <div>
                                    <label className={`text-sm font-medium ${mutedText} block mb-1.5`}>GitHub Repository URL</label>
                                    <input
                                        type="text"
                                        placeholder="https://github.com/your-org/your-repo"
                                        value={formData.repoUrl}
                                        onChange={(e) => setFormData({ ...formData, repoUrl: e.target.value })}
                                        className={`w-full px-4 py-3 rounded-xl text-sm outline-none ${isDark
                                                ? "bg-[#1A2235] border border-[#1E293B] focus:border-[#00E5CC] text-white"
                                                : "bg-[#F5F3F0] border border-[#E5E2DC] focus:border-[#00E5CC]"
                                            }`}
                                    />
                                </div>
                                <div>
                                    <label className={`text-sm font-medium ${mutedText} block mb-1.5`}>Project Name</label>
                                    <input
                                        type="text"
                                        placeholder="My Awesome Framework"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={`w-full px-4 py-3 rounded-xl text-sm outline-none ${isDark
                                                ? "bg-[#1A2235] border border-[#1E293B] focus:border-[#00E5CC] text-white"
                                                : "bg-[#F5F3F0] border border-[#E5E2DC] focus:border-[#00E5CC]"
                                            }`}
                                    />
                                </div>
                                <div>
                                    <label className={`text-sm font-medium ${mutedText} block mb-1.5`}>Description</label>
                                    <textarea
                                        placeholder="A brief description of what your project does..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                        className={`w-full px-4 py-3 rounded-xl text-sm outline-none resize-none ${isDark
                                                ? "bg-[#1A2235] border border-[#1E293B] focus:border-[#00E5CC] text-white"
                                                : "bg-[#F5F3F0] border border-[#E5E2DC] focus:border-[#00E5CC]"
                                            }`}
                                    />
                                </div>
                                <div>
                                    <label className={`text-sm font-medium ${mutedText} block mb-1.5`}>Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className={`w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer ${isDark
                                                ? "bg-[#1A2235] border border-[#1E293B] focus:border-[#00E5CC] text-white"
                                                : "bg-[#F5F3F0] border border-[#E5E2DC] focus:border-[#00E5CC]"
                                            }`}
                                    >
                                        <option value="infrastructure">Infrastructure</option>
                                        <option value="framework">Framework</option>
                                        <option value="library">Library</option>
                                        <option value="tooling">Developer Tooling</option>
                                        <option value="security">Security</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Step 1: GitHub Metrics */}
                        {step === 1 && (
                            <div className="max-w-lg mx-auto animate-fade-in">
                                {!fakeMetrics ? (
                                    <div className="text-center py-12">
                                        <div className="w-8 h-8 border-2 border-[#00E5CC] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                        <p className={`text-sm ${mutedText}`}>Fetching GitHub metrics...</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        {Object.entries(fakeMetrics).map(([key, val]) => (
                                            <div key={key} className={`rounded-xl p-4 ${isDark ? "bg-[#1A2235]" : "bg-[#F5F3F0]"}`}>
                                                <p className={`text-xs capitalize ${mutedText} mb-1`}>{key.replace(/([A-Z])/g, ' $1')}</p>
                                                <p className="text-lg font-bold font-matter">{val}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 2: Review */}
                        {step === 2 && (
                            <div className="max-w-lg mx-auto animate-fade-in">
                                <div className={`rounded-xl p-5 space-y-3 ${isDark ? "bg-[#1A2235]" : "bg-[#F5F3F0]"}`}>
                                    {[
                                        { label: "Repository", value: formData.repoUrl },
                                        { label: "Name", value: formData.name },
                                        { label: "Description", value: formData.description || "—" },
                                        { label: "Category", value: formData.category },
                                        { label: "Stars", value: fakeMetrics?.stars },
                                        { label: "Contributors", value: fakeMetrics?.contributors },
                                    ].map((row) => (
                                        <div key={row.label} className="flex justify-between">
                                            <span className={`text-sm ${mutedText}`}>{row.label}</span>
                                            <span className="text-sm font-medium text-right max-w-[60%] truncate">{row.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Submitted */}
                        {step === 3 && (
                            <div className="text-center py-8 animate-scale-in">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#00E5CC]/20 mb-4">
                                    <IconCheck className="w-8 h-8 text-[#00E5CC]" />
                                </div>
                                <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                                    Project Submitted!
                                </h3>
                                <p className={`text-sm ${mutedText}`}>
                                    Your project is under review. You&#39;ll be notified once it&#39;s approved and listed.
                                </p>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        {step < 3 && (
                            <div className="flex items-center justify-between mt-8 max-w-lg mx-auto">
                                <button
                                    onClick={() => step > 0 ? setStep(step - 1) : setShowForm(false)}
                                    className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all cursor-pointer ${isDark ? "hover:bg-[#1A2235]" : "hover:bg-[#F0EEEB]"
                                        } ${mutedText}`}
                                >
                                    {step === 0 ? "Cancel" : "Back"}
                                </button>
                                <button
                                    onClick={handleNext}
                                    className="px-6 py-2.5 bg-[#00E5CC] text-[#0A0F1E] font-bold text-sm rounded-xl hover:bg-[#00D4BD] transition-all cursor-pointer"
                                >
                                    {step === 2 ? "Submit" : "Next"}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Project Grid */}
                <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                    Registered Projects
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {registeredProjects.map((project) => (
                        <div key={project.name} className={`rounded-xl p-5 hover-lift transition-all ${cardBg}`}>
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h4 className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)" }}>{project.name}</h4>
                                    <p className={`text-xs ${mutedText}`}>{project.org}</p>
                                </div>
                                <div className={`px-2.5 py-1 rounded-lg text-xs font-bold font-matter ${getScoreColor(project.score)} ${isDark ? "bg-[#1A2235]" : "bg-[#F5F3F0]"
                                    }`}>
                                    {project.score}
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs ${mutedText}`}>⭐ {project.stars}</span>
                                    <span className={`text-xs ${mutedText}`}>{project.lang}</span>
                                </div>
                                <span className={`inline-flex items-center gap-1 text-xs font-medium ${project.status === "Verified" ? "text-[#00E5CC]" : "text-yellow-400"
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${project.status === "Verified" ? "bg-[#00E5CC]" : "bg-yellow-400"
                                        }`} />
                                    {project.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
