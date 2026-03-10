import React from "react";
import Link from "next/link";
import { Github, Zap, ArrowRight, ShieldCheck } from "lucide-react";
import DotGrid from "@/components/DotGrid";

export default function SignupPage() {
    return (
        <div className="flex-1 flex items-center justify-center min-h-[90vh] py-24 px-6 relative bg-background overflow-hidden">
            <DotGrid
                className="absolute inset-0 opacity-30 z-0"
                baseColor="hsl(var(--muted-foreground))"
                activeColor="hsl(var(--primary))"
                returnDuration={2}
                proximity={100}
            />

            <div className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-border p-8 md:p-12 rounded-[2rem] shadow-2xl relative z-10 animate-fade-in">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                        <Zap className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-black font-heading text-center mb-2">Claim Your Identity</h1>
                    <p className="text-muted-foreground text-center font-medium">Link your profiles to start earning.</p>
                </div>

                <div className="space-y-4">
                    <button className="w-full relative group overflow-hidden rounded-xl border border-border bg-foreground text-background p-4 flex items-center justify-center space-x-3 hover:opacity-90 transition-opacity shadow-glow">
                        <Github className="w-5 h-5" />
                        <span className="font-semibold">Sign up with GitHub</span>
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground font-semibold">Decentralized Trust</span>
                        </div>
                    </div>

                    <div className="bg-secondary/40 border border-border rounded-xl p-4 flex items-start space-x-3 text-sm text-muted-foreground">
                        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p>Your identity is minted as a verifiable DID. We never store personal data or private keys.</p>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-border flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Already have an account?</span>
                    <Link href="/login" className="text-sm font-bold flex items-center space-x-1 text-foreground hover:text-primary transition-colors">
                        <span>Log in</span>
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
