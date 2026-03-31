"use client"
import React, { useEffect, useState, memo } from 'react';
import { Github, Fingerprint, Hexagon, Atom } from 'lucide-react';

// --- Type Definitions ---
type IconType = 'github' | 'stripe' | 'ipfs' | 'flow' | 'did';

type GlowColor = 'cyan' | 'purple' | 'blue';

interface SkillIconProps {
    type: IconType;
}

interface SkillConfig {
    id: string;
    orbitRadius: number;
    size: number;
    speed: number;
    iconType: IconType;
    phaseShift: number;
    glowColor: GlowColor;
    label: string;
}

interface OrbitingSkillProps {
    config: SkillConfig;
    angle: number;
}

interface GlowingOrbitPathProps {
    radius: number;
    glowColor?: GlowColor;
    animationDelay?: number;
}

// --- Improved SVG Icon Components ---
const iconComponents: Record<IconType, { component: () => React.JSX.Element; color: string }> = {
    github: {
        component: () => (
            <Github className="w-full h-full text-foreground" />
        ),
        color: '#333'
    },
    stripe: {
        component: () => (
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ transform: "scaleX(-1)" }} className="w-full h-full text-[#635BFF]">
                <path d="M13.962 8.351c0-1.157-.932-1.579-2.518-1.579-1.396 0-3.078.434-3.078.434l-.32-2.395s1.77-.527 3.65-.527c3.153 0 5.164 1.54 5.164 4.39 0 4.14-5.69 4.354-5.69 6.273 0 .725.61 1.119 1.583 1.119 1.488 0 3.29-.554 3.29-.554l.32 2.45s-1.487.646-3.804.646c-3.153 0-4.305-1.542-4.305-4.22 0-3.957 5.708-4.218 5.708-6.077z" />
            </svg>
        ),
        color: '#635BFF'
    },
    ipfs: {
        component: () => (
            <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden p-[2px]">
                <img src="https://upload.wikimedia.org/wikipedia/commons/c/c2/IPFS_logo.png" alt="IPFS" className="w-full h-full object-contain" />
            </div>
        ),
        color: '#65C2CB'
    },
    flow: {
        component: () => (
            <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden p-[2px]">
                <img src="https://auth.devspot.app/storage/v1/object/public/hackathon-images/sponsors/Flow/3045fff0-2153-41d8-b5f6-9adb15476acb.svg" alt="Flow" className="w-full h-full object-contain" />
            </div>
        ),
        color: '#00EF8B'
    },
    did: {
        component: () => (
            <Fingerprint className="w-full h-full text-foreground" />
        ),
        color: '#5227FF'
    }
};

const SkillIcon = memo(({ type }: SkillIconProps) => {
    const IconComponent = iconComponents[type]?.component;
    return IconComponent ? <IconComponent /> : null;
});
SkillIcon.displayName = 'SkillIcon';

const skillsConfig: SkillConfig[] = [
    // Inner Orbit
    {
        id: 'github',
        orbitRadius: 100,
        size: 42,
        speed: 0.8,
        iconType: 'github',
        phaseShift: 0,
        glowColor: 'blue',
        label: 'GitHub'
    },
    {
        id: 'stripe',
        orbitRadius: 100,
        size: 48,
        speed: 0.8,
        iconType: 'stripe',
        phaseShift: (2 * Math.PI) / 3,
        glowColor: 'purple',
        label: 'Stripe'
    },
    {
        id: 'did_inner',
        orbitRadius: 100,
        size: 40,
        speed: 0.8,
        iconType: 'did',
        phaseShift: (4 * Math.PI) / 3,
        glowColor: 'cyan',
        label: 'Digital Identity'
    },
    // Outer Orbit
    {
        id: 'ipfs',
        orbitRadius: 190,
        size: 55,
        speed: -0.4,
        iconType: 'ipfs',
        phaseShift: 0,
        glowColor: 'cyan',
        label: 'IPFS'
    },
    {
        id: 'flow',
        orbitRadius: 190,
        size: 50,
        speed: -0.4,
        iconType: 'flow',
        phaseShift: Math.PI,
        glowColor: 'cyan',
        label: 'Flow'
    }
];

const OrbitingSkill = memo(({ config, angle }: OrbitingSkillProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const { orbitRadius, size, iconType, label } = config;

    const x = Number((Math.cos(angle) * orbitRadius).toFixed(4));
    const y = Number((Math.sin(angle) * orbitRadius).toFixed(4));

    return (
        <div
            className="absolute top-1/2 left-1/2 transition-all duration-300 ease-out"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                marginLeft: `${-size / 2}px`,
                marginTop: `${-size / 2}px`,
                transform: `translate(${x}px, ${y}px)`,
                zIndex: isHovered ? 20 : 10,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                className={`
          relative w-full h-full p-2 bg-background/90 backdrop-blur-sm
          rounded-2xl border border-border flex items-center justify-center
          transition-all duration-300 cursor-pointer
          ${isHovered ? 'scale-125 shadow-2xl border-primary/50' : 'shadow-lg hover:shadow-xl'}
        `}
                style={{
                    boxShadow: isHovered
                        ? `0 0 30px ${iconComponents[iconType]?.color}40, 0 0 60px ${iconComponents[iconType]?.color}20`
                        : undefined
                }}
            >
                <SkillIcon type={iconType} />
                {isHovered && (
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-card/95 backdrop-blur-sm rounded text-[10px] font-bold text-foreground whitespace-nowrap pointer-events-none uppercase tracking-widest border border-border">
                        {label}
                    </div>
                )}
            </div>
        </div>
    );
});
OrbitingSkill.displayName = 'OrbitingSkill';

const GlowingOrbitPath = memo(({ radius, glowColor = 'cyan', animationDelay = 0 }: GlowingOrbitPathProps) => {
    const glowColors = {
        cyan: {
            primary: 'rgba(6, 182, 212, 0.2)',
            secondary: 'rgba(6, 182, 212, 0.1)',
            border: 'rgba(6, 182, 212, 0.2)'
        },
        purple: {
            primary: 'rgba(147, 51, 234, 0.2)',
            secondary: 'rgba(147, 51, 234, 0.1)',
            border: 'rgba(147, 51, 234, 0.2)'
        },
        blue: {
            primary: 'rgba(59, 130, 246, 0.2)',
            secondary: 'rgba(59, 130, 246, 0.1)',
            border: 'rgba(59, 130, 246, 0.2)'
        }
    };

    const colors = glowColors[glowColor] || glowColors.cyan;

    return (
        <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
                width: `${radius * 2}px`,
                height: `${radius * 2}px`,
                animationDelay: `${animationDelay}s`,
            }}
        >
            <div
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                    background: `radial-gradient(circle, transparent 50%, ${colors.secondary} 80%, ${colors.primary} 100%)`,
                    boxShadow: `0 0 40px ${colors.primary}, inset 0 0 40px ${colors.secondary}`,
                    animation: 'pulse 6s ease-in-out infinite',
                    animationDelay: `${animationDelay}s`,
                }}
            />
            <div
                className="absolute inset-0 rounded-full"
                style={{
                    border: `1px dashed ${colors.border}`,
                    opacity: 0.3
                }}
            />
        </div>
    );
});
GlowingOrbitPath.displayName = 'GlowingOrbitPath';

export default function OrbitingEcosystem() {
    const [time, setTime] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isPaused) return;

        let animationFrameId: number;
        let lastTime = performance.now();

        const animate = (currentTime: number) => {
            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;

            setTime(prevTime => prevTime + deltaTime);
            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isPaused]);

    const orbitConfigs: Array<{ radius: number; glowColor: GlowColor; delay: number }> = [
        { radius: 100, glowColor: 'blue', delay: 0 },
        { radius: 190, glowColor: 'purple', delay: 2 }
    ];

    return (
        <div className="w-full flex items-center justify-center overflow-visible py-10">
            <div
                className="relative w-[500px] h-[500px] flex items-center justify-center"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
            >
                {/* Central Kinetic Icon */}
                <div className="w-28 h-28 rounded-full flex items-center justify-center z-10 relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl animate-pulse"></div>
                    <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl"></div>

                    <div className="relative z-10 w-full h-full bg-background border border-primary/50 rounded-full flex items-center justify-center shadow-glow overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent"></div>
                        <div className="flex flex-col items-center justify-center">
                            <Atom className="w-10 h-10 text-primary animate-[spin_6s_linear_infinite]" />
                            <span className="font-heading font-black text-xs tracking-[0.2em] mt-2 text-primary">KINETIC</span>
                        </div>
                    </div>

                    {/* Ring animation */}
                    <div className="absolute inset-x-[-15%] inset-y-[-15%] rounded-full border border-primary/20 animate-[spin_12s_linear_infinite]"></div>
                    <div className="absolute inset-x-[-25%] inset-y-[-25%] rounded-full border border-primary/10 animate-[spin_20s_linear_infinite_reverse]"></div>
                </div>

                {/* Render glowing orbit paths */}
                {orbitConfigs.map((config) => (
                    <GlowingOrbitPath
                        key={`path-${config.radius}`}
                        radius={config.radius}
                        glowColor={config.glowColor}
                        animationDelay={config.delay}
                    />
                ))}

                {/* Render orbiting ecosystem elements */}
                {skillsConfig.map((config) => {
                    const angle = time * config.speed + (config.phaseShift || 0);
                    return (
                        <OrbitingSkill
                            key={config.id}
                            config={config}
                            angle={angle}
                        />
                    );
                })}
            </div>
        </div>
    );
}
