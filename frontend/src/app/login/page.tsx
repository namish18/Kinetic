import React from "react";
import Link from "next/link";
import { Github, Fingerprint, ArrowRight } from "lucide-react";
import DotGrid from "@/components/DotGrid";

export default function LoginPage() {
    return (
        <div className="flex-1 flex items-center justify-center min-h-[90vh] py-24 px-6 relative bg-background overflow-hidden">
            <DotGrid
                className="absolute inset-0 opacity-30 z-0"
                baseColor="hsl(var(--muted-foreground))"
                activeColor="hsl(var(--primary))"
                returnDuration={2}
                proximity={100}
            />

            <div className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-border p-8 md:p-12 rounded-[2rem] shadow-2xl relative z-10 animate-scale-in">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                        <Fingerprint className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-black font-heading text-center mb-2">Welcome Back</h1>
                    <p className="text-muted-foreground text-center font-medium">Continue your open-source journey.</p>
                </div>

                <div className="space-y-4">
                    <button className="w-full relative group overflow-hidden rounded-xl border border-border bg-background p-4 flex items-center justify-center space-x-3 hover:border-primary/50 transition-colors">
                        <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <Github className="w-5 h-5 text-foreground" />
                        <span className="font-semibold text-foreground">Sign in with GitHub</span>
                    </button>

                    <button className="w-full relative group overflow-hidden rounded-xl border border-border bg-background p-4 flex items-center justify-center space-x-3 hover:border-primary/50 transition-colors">
                        <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.477.5 2 5 2 5v9c0 5 10 10 10 10s10-5 10-10V5s-4.477-4.5-10-3Zm0 17.5c-4.142-3.83-8-8.17-8-12.5V6.75C8 5.5 12 4 12 4s4 1.5 8 2.75V10c0 4.33-3.858 8.67-8 9.5Z" />
                        </svg>
                        <span className="font-semibold text-foreground">Connect Flow Wallet</span>
                    </button>
                </div>

                <div className="mt-8 pt-8 border-t border-border flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Don't have an account?</span>
                    <Link href="/signup" className="text-sm font-bold flex items-center space-x-1 text-primary hover:opacity-80 transition-opacity">
                        <span>Sign up</span>
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
