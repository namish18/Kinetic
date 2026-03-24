"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Github, Zap, ArrowRight, ShieldCheck, Building, User } from "lucide-react";
import DotGrid from "@/components/DotGrid";

export default function SignupPage() {
    const [role, setRole] = useState<'contributor' | 'organization'>('contributor');
    
    const handleGithubSignup = () => {
        window.location.href = `http://localhost:5000/api/auth/github?role=${role}`;
    };

    return (
        <div className="grid place-items-center min-h-screen w-full relative bg-background overflow-hidden p-6">
            <DotGrid
                className="absolute inset-0 opacity-30 z-0"
                baseColor="hsl(var(--muted-foreground))"
                activeColor="hsl(var(--primary))"
                returnDuration={2}
                proximity={100}
            />

            <div className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-border p-8 md:p-12 rounded-[2rem] shadow-2xl relative z-20 animate-fade-in">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                        <Zap className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-black font-heading text-center mb-2">Claim Your Identity</h1>
                    <p className="text-muted-foreground text-center font-medium">Link your profiles to start earning.</p>
                </div>

                <div className="flex items-center p-1 bg-muted/50 rounded-xl mb-6">
                    <button 
                        onClick={() => setRole('contributor')}
                        className={`flex-1 py-2 px-3 flex items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all ${role === 'contributor' ? 'bg-background shadow font-black text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <User className="w-4 h-4" /> Contributor
                    </button>
                    <button 
                        onClick={() => setRole('organization')}
                        className={`flex-1 py-2 px-3 flex items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all ${role === 'organization' ? 'bg-background shadow font-black text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Building className="w-4 h-4" /> Organization
                    </button>
                </div>

                <div className="space-y-4">
                    <button onClick={handleGithubSignup} className="w-full relative group overflow-hidden rounded-xl border border-border bg-foreground text-background p-4 flex items-center justify-center space-x-3 hover:opacity-90 transition-opacity shadow-glow">
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
