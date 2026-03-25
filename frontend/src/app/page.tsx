import Threads from "@/components/Threads";
import SplitText from "@/components/SplitText";
import BlurText from "@/components/BlurText";
import DotGrid from "@/components/DotGrid";
import LogoLoop from "@/components/LogoLoop";
import OrbitingEcosystem from "@/components/ui/OrbitingEcosystem";
import { Github, Wallet, Fingerprint, Activity, Award, Briefcase, Zap, Star, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";

const TickerItem = ({ text }: { text: string }) => (
  <div className="flex items-center space-x-2 text-sm font-mono font-medium whitespace-nowrap px-4 opacity-80 border-r border-border/50">
    <Zap className="w-4 h-4 text-primary animate-pulse" />
    <span>{text}</span>
  </div>
);

export default function LandingPage() {
  const payouts = [
    { node: <TickerItem text="Paid 24.5 FLOW to @alicedev for PR #901 on go-ipfs" /> },
    { node: <TickerItem text="Paid 12.1 FLOW to @stebien for Issue #22 on libp2p" /> },
    { node: <TickerItem text="Paid 45.0 FLOW to @daviddias for PR #442 on lotus" /> },
    { node: <TickerItem text="Paid 8.9 FLOW to @momack2 for Issue #11 on filecoin-project" /> },
    { node: <TickerItem text="Paid 33.2 FLOW to @why for PR #88 on rust-libp2p" /> },
    { node: <TickerItem text="Paid 15.5 FLOW to @raulk for PR #671 on testground" /> },
  ];

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative min-h-[95vh] flex flex-col items-center justify-center overflow-hidden">
        <Threads amplitude={1.5} distance={10} enableMouseInteraction />

        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-7xl mx-auto space-y-12">
          {/* Badge styled like "Powered by Advanced AI" */}
          <div className="inline-flex items-center space-x-2 bg-secondary/30 backdrop-blur-xl rounded-full px-5 py-2 text-sm font-semibold text-secondary-foreground border border-border/50 animate-fade-in shadow-sm">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            <span>Now on the Flow Blockchain Mainnet</span>
          </div>

          <div className="space-y-6 flex flex-col items-center">
            <BlurText
              text="Reward the engineers building the distributed web."
              delay={100}
              animateBy="words"
              direction="top"
              className="text-primary font-mono font-bold tracking-[0.1em] uppercase text-2xl md:text-3xl justify-center w-full"
            />

            <SplitText
              text="From Commits to <span class='italic font-serif text-primary/90'>Protocol Capital</span>"
              className="text-[48px] md:text-[92px] font-black font-sans tracking-[-0.08em] leading-[1.1] text-foreground drop-shadow-sm max-w-[1250px] px-4 py-4"
              delay={40}
              duration={0.9}
              ease="power4.out"
              splitType="chars"
              from={{ opacity: 0, scale: 0.9, y: 120 }}
              to={{ opacity: 1, scale: 1, y: 0 }}
            />
          </div>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl font-normal animate-fade-in opacity-80 leading-relaxed tracking-tight" style={{ animationDelay: '0.4s' }}>
            Transform your contributions into tangible assets with Kinetic. Verified merges across core repos, algorithmically priced complexity, and autonomous FLOW payouts.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 pt-4 animate-fade-in w-full sm:w-auto" style={{ animationDelay: '0.6s' }}>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center space-x-3 bg-secondary text-foreground font-bold px-10 py-4.5 rounded-full hover:bg-secondary/80 active:scale-95 transition-all duration-300 border border-border/50 text-lg group"
            >
              <span>Launch Dashboard</span>
              <div className="flex items-center -space-x-1 group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-5 h-5" />
              </div>
            </Link>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 border-y border-border/50 bg-background/40 backdrop-blur-md py-3 flex overflow-hidden z-20">
          <LogoLoop logos={payouts} speed={80} direction="left" logoHeight={24} gap={0} pauseOnHover />
        </div>

        {/* Gradient shadow to blend into the next section */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </section>

      {/* Features Section */}
      <section className="relative py-32 overflow-hidden bg-background">
        <DotGrid
          className="absolute inset-0 opacity-40 z-0"
          baseColor="hsl(var(--muted-foreground))"
          activeColor="hsl(var(--primary))"
          returnDuration={2}
          proximity={100}
        />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center space-y-4 mb-20 animate-slide-up">
            <h2 className="text-4xl md:text-5xl font-black font-heading">The Ecosystem <span className="italic font-serif">Valuation Engine</span></h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We measure task complexity across open-source networks and compensate you through verified engineering signals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card/60 backdrop-blur-md border border-border p-8 rounded-4xl shadow-md dark:shadow-glow hover:-translate-y-2 transition-transform duration-300 ease-out-back animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Fingerprint className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold font-heading mb-3">DID Identity</h3>
              <p className="text-muted-foreground leading-relaxed">
                Connect your GitHub to mint a Decentralized Identifier (DID). Your commits, PRs, and issues become verifiable credentials bound to your identity.
              </p>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border p-8 rounded-4xl shadow-md dark:shadow-glow hover:-translate-y-2 transition-transform duration-300 ease-out-back animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Activity className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold font-heading mb-3">Valuation Algo</h3>
              <p className="text-muted-foreground leading-relaxed">
                Our proprietary algorithm prices contributions based on task complexity, log-scaled impact, and network reputation to calculate your fair reward share.
              </p>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border p-8 rounded-4xl shadow-md dark:shadow-glow hover:-translate-y-2 transition-transform duration-300 ease-out-back animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Award className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold font-heading mb-3">FLOW Payout</h3>
              <p className="text-muted-foreground leading-relaxed">
                Tokens stream directly into your wallet via Flow smart contracts. Fast finalized payouts, zero hidden fees, and entirely autonomous allocation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem Section */}
      <section className="relative py-32 bg-card overflow-hidden border-y border-border">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-4xl md:text-5xl font-black font-heading">The <span className="italic font-serif">Un-Gameable</span> Algorithm</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              The Valuation Algorithm evaluates 5 independent signal dimensions that must all mathematically agree. Fake stars and bots won't save you here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {[
              { title: "Task Complexity", percent: "20%", desc: "Log-scaled lines of code changed to favor architectural depth over volume." },
              { title: "Verified Impact", percent: "20%", desc: "Measures changed files and commit density to filter out spam or micro-PRs." },
              { title: "Code Quality", percent: "20%", desc: "Analyzes refactor ratios and deletion-to-addition metrics for software health." },
              { title: "Review Friction", percent: "20%", desc: "Tracks review cycles and requested changes. Deep collaboration = high value." },
              { title: "Repository Priority", percent: "20%", desc: "Weighted by the repository's urgency and strategic importance in the network." },
              { title: "Reputation Boost", percent: "Multiplier", desc: "Long-term maintainers receive a significant boost to their baseline score." }
            ].map((layer, i) => (
              <div key={i} className="bg-background border border-border rounded-3xl p-6 shadow-sm hover:border-primary/50 transition-colors flex flex-col justify-between">
                <div>
                  <div className="text-primary font-mono font-bold text-xl mb-2">{layer.percent}</div>
                  <h4 className="font-bold text-lg mb-3">{layer.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground">{layer.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
            <div className="md:w-2/3 space-y-4">
              <div className="inline-flex items-center space-x-2 bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-bold mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Anti-Gaming Protocol</span>
              </div>
              <h3 className="text-3xl font-black">Proof-of-Build Verification</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                No code is priced unless accompanied by a verified CI/CD execution trace. We dynamically query GitHub Actions to mathematically prove your code compiled and ran successfully.
              </p>
            </div>
            <div className="md:w-1/3 bg-background border border-border p-5 rounded-2xl font-mono text-sm overflow-hidden text-muted-foreground w-full">
              <div className="text-green-500 mb-2">{`> Verify execution trace...`}</div>
              <div className="opacity-80 break-all">{`Status: COMPLETED`}</div>
              <div className="opacity-80 break-all">{`Conclusion: SUCCESS`}</div>
              <div className="text-primary font-bold mt-4">{`ProofOfBuild_Multiplier = 1.0`}</div>
              <div className="text-green-500 font-bold mt-2">{`[ Score Authenticated ]`}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-primary text-primary-foreground text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10 z-0"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10 space-y-8 flex flex-col items-center animate-slide-up">
          <h2 className="text-5xl md:text-7xl font-black font-heading drop-shadow-lg">Build the <span className="italic font-serif">Web3 Infrastructure</span>. <br /> Get Paid <span className="italic font-serif">Today</span>.</h2>
          <p className="text-xl md:text-2xl max-w-2xl opacity-90 font-medium">Join the elite rank of contributors turning their commits into a sustainable career.</p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex items-center space-x-2 bg-background text-foreground font-bold px-10 py-5 rounded-full hover:scale-105 transition-transform duration-300 ease-out-back shadow-[0_0_40px_rgba(255,255,255,0.3)] text-lg"
          >
            <Github className="w-6 h-6" />
            <span>Connect GitHub Now</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
