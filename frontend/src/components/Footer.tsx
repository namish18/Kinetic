"use client";
import React from "react";
import Link from "next/link";
import {
    NotepadTextDashed,
    Twitter,
    Linkedin,
    Github,
    Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Globe } from "@/components/ui/globe";

interface FooterLink {
    label: string;
    href: string;
}

interface SocialLink {
    icon: React.ReactNode;
    href: string;
    label: string;
}

interface FooterProps {
    brandName?: string;
    brandDescription?: string;
    socialLinks?: SocialLink[];
    navLinks?: FooterLink[];
    creatorName?: string;
    creatorUrl?: string;
    brandIcon?: React.ReactNode;
    className?: string;
}

export const Footer = ({
    brandName = "Kinetic",
    brandDescription = "Your commits deserve capital. Fund the code that runs the world.",
    socialLinks = [
        { icon: <Github />, href: "https://github.com", label: "GitHub" },
        { icon: <Twitter />, href: "https://twitter.com", label: "Twitter" },
        { icon: <Linkedin />, href: "https://linkedin.com", label: "LinkedIn" },
        { icon: <Mail />, href: "mailto:hello@kinetic.com", label: "Email" },
    ],
    navLinks = [],
    creatorName = "Team Kinetic",
    creatorUrl = "#",
    brandIcon,
    className,
}: FooterProps) => {
    return (
        <section className={cn("relative w-full mt-0 overflow-hidden", className)}>
            <footer className="border-t bg-background mt-20 relative">
                <div className="max-w-7xl flex flex-col justify-between mx-auto min-h-[30rem] sm:min-h-[35rem] md:min-h-[40rem] relative p-4 py-10">
                    <div className="flex flex-col mb-12 sm:mb-20 md:mb-0 w-full">
                        <div className="w-full flex flex-col items-center">
                            <div className="space-y-2 flex flex-col items-center flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-foreground text-3xl font-bold font-heading">
                                        {brandName}
                                    </span>
                                </div>
                                <p className="text-muted-foreground font-semibold text-center w-full max-w-sm sm:w-96 px-4 sm:px-0">
                                    {brandDescription}
                                </p>
                            </div>

                            {socialLinks.length > 0 && (
                                <div className="flex mb-8 mt-3 gap-4">
                                    {socialLinks.map((link, index) => (
                                        <Link
                                            key={index}
                                            href={link.href}
                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <div className="w-6 h-6 hover:scale-110 duration-300">
                                                {link.icon}
                                            </div>
                                            <span className="sr-only">{link.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}

                        </div>
                    </div>

                    <div className="mt-20 md:mt-24 flex flex-col gap-2 md:gap-1 items-center justify-center md:flex-row md:items-center md:justify-between px-4 md:px-0">
                        <p className="text-base text-muted-foreground text-center md:text-left">
                            ©{new Date().getFullYear()} {brandName}. All rights reserved.
                        </p>
                        {creatorName && creatorUrl && (
                            <nav className="flex gap-4">
                                <Link
                                    href={creatorUrl}
                                    target="_blank"
                                    className="text-base text-muted-foreground hover:text-foreground transition-colors duration-300 hover:font-medium"
                                >
                                    Crafted by Yantram.dev
                                </Link>
                            </nav>
                        )}
                    </div>
                </div>

                {/* Large background text */}
                <div
                    className="font-heading bg-gradient-to-b from-foreground/90 via-foreground/40 to-transparent bg-clip-text text-transparent leading-none absolute left-1/2 -translate-x-1/2 bottom-[80px] md:bottom-[100px] font-black tracking-tighter pointer-events-none select-none text-center px-4 z-30"
                    style={{
                        fontSize: 'clamp(5rem, 25vw, 22rem)',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {brandName.toUpperCase()}
                </div>

                {/* Rising Globe effect at the bottom */}
                <div className="absolute -bottom-[600px] left-1/2 -translate-x-1/2 w-full max-w-[1600px] h-[1200px] pointer-events-none overflow-hidden opacity-30 z-10">
                    <Globe className="top-0" />
                </div>

                {/* Bottom line */}
                <div className="absolute bottom-32 sm:bottom-34 backdrop-blur-sm h-1 bg-gradient-to-r from-transparent via-border to-transparent w-full left-1/2 -translate-x-1/2 z-20"></div>

            </footer>
        </section>
    );
};
