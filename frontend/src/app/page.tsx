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
    { node: <TickerItem text="Paid 24.5 FIL to @juanbenet for PR #901 on go-ipfs" /> },
    { node: <TickerItem text="Paid 12.1 FIL to @stebien for Issue #22 on libp2p" /> },
    { node: <TickerItem text="Paid 45.0 FIL to @daviddias for PR #442 on lotus" /> },
    { node: <TickerItem text="Paid 8.9 FIL to @momack2 for Issue #11 on filecoin-project" /> },
    { node: <TickerItem text="Paid 33.2 FIL to @why for PR #88 on rust-libp2p" /> },
    { node: <TickerItem text="Paid 15.5 FIL to @raulk for PR #671 on testground" /> },
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
            <span>Now on the Filecoin Blockchain Testnet</span>
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
            Transform your contributions into tangible assets with Kinetic. Verified merges across Protocol Labs repos, algorithmically scored complexity, and autonomous FIL payouts.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 pt-4 animate-fade-in w-full sm:w-auto" style={{ animationDelay: '0.6s' }}>
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center space-x-3 bg-secondary text-foreground font-bold px-10 py-4.5 rounded-full hover:bg-secondary/80 active:scale-95 transition-all duration-300 border border-border/50 text-lg group"
            >
              <span>Get Started for Free</span>
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
            <h2 className="text-4xl md:text-5xl font-black font-heading">The Ecosystem <span className="italic font-serif">Contribution Engine</span></h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We measure task complexity across the PL network and compensate you through verified engineering signals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card/60 backdrop-blur-md border border-border p-8 rounded-4xl shadow-md dark:shadow-glow hover:-translate-y-2 transition-transform duration-300 ease-out-back animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Fingerprint className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold font-heading mb-3">DID Identity</h3>
              <p className="text-muted-foreground leading-relaxed">
                Connect your GitHub to mint a Decentralized Identifier (DID). Your commits, PRs, and issues become verifiable credentials bound to your identity, completely privacy-preserving.
              </p>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border p-8 rounded-4xl shadow-md dark:shadow-glow hover:-translate-y-2 transition-transform duration-300 ease-out-back animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Activity className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold font-heading mb-3">MSTS Engine</h3>
              <p className="text-muted-foreground leading-relaxed">
                Our proprietary MSTS algorithm ranks contributions based on task complexity, code survival, and cross-repo impact to calculate your fair Value Score.
              </p>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border p-8 rounded-4xl shadow-md dark:shadow-glow hover:-translate-y-2 transition-transform duration-300 ease-out-back animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Award className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold font-heading mb-3">FIL Payout</h3>
              <p className="text-muted-foreground leading-relaxed">
                Tokens stream directly into your wallet via Filecoin smart contracts. Fast finalized payouts, zero hidden fees, and entirely autonomous allocation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem Section */}
      <section className="relative py-32 bg-card overflow-hidden border-y border-border">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-4xl md:text-5xl font-black font-heading">The <span className="italic font-serif">Un-Gameable</span> Engine</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our Multi-Signal Triangulation Score (MSTS) evaluates 5 independent signal layers that must all mathematically agree. Fake stars and bots won't save you here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {[
              { title: "Task Complexity", percent: "30%", desc: "Base logic: lines changed + files touched + issue labels (security/refactor) + competition factor." },
              { title: "Code Survival", percent: "20%", desc: "Measures quality via churn analysis: what percentage of your code survived untouched for 6+ months?" },
              { title: "Issue Velocity", percent: "20%", desc: "Time-to-close for critical path issues, weighted heavily by repo tier (e.g., Lotus vs Experimental)." },
              { title: "PR Review Depth", percent: "15%", desc: "Tracks review cycles, comment density, and requested changes. Deep friction = complex engineering." },
              { title: "Cross-Repo Bonus", percent: "10%", desc: "1.25x Multiplier for contributors submitting merged code to 3+ distinct PL repositories." },
              { title: "Temporal Decay", percent: "5%", desc: "Favors recent, active maintenance. Reputation must be earned through continuous execution." }
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
                <span>Anti-Sybil Protocol</span>
              </div>
              <h3 className="text-3xl font-black">Proof-of-Build Verification</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                No code is scored unless accompanied by a verified CI/CD execution trace. We dynamically query GitHub Actions to mathematically prove your code compiled and ran successfully. No trace? Multiplier = 0.
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

          <div className="bg-foreground text-background border border-border rounded-3xl p-8 relative overflow-hidden flex flex-col md:flex-row-reverse items-center justify-between gap-8 mb-12">
            <div className="md:w-2/3 space-y-4">
              <div className="inline-flex items-center space-x-2 bg-background/20 text-secondary px-3 py-1 rounded-full text-sm font-bold mb-2">
                <Activity className="w-4 h-4" />
                <span>Meritocratic Protocol</span>
              </div>
              <h3 className="text-3xl font-black">PR Review Depth Multipliers</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Social popularity and community voting are gameable. We prioritize deep engineering cycles. PRs with rigorous review rounds, multiple requested changes, and high comment density receive a complexity bonus, ensuring high-leverage work is rewarded over simple fixes.
              </p>
            </div>
            <div className="md:w-1/3 bg-card border border-border p-5 rounded-2xl font-mono text-sm overflow-hidden text-muted-foreground w-full shadow-inner">
              <div className="text-blue-500 mb-2">{`> Analyze Review Depth...`}</div>
              <div className="opacity-80">{`Review Cycles: 4`}</div>
              <div className="opacity-80">{`Comment Density: HIGH`}</div>
              <div className="text-secondary font-bold mt-4">{`Base Complexity: 1.2x`}</div>
              <div className="text-green-500 font-bold mt-2">{`Final Task Weight: 1.85x`}</div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-4xl p-10 relative overflow-hidden">
            <h3 className="text-3xl font-black mb-8 text-center uppercase tracking-tighter">The Algorithm <span className="italic font-serif">Evolution</span></h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/50 rounded-2xl overflow-hidden border border-border">
              <div className="bg-background p-6">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6">Old Era (Open Source)</div>
                <ul className="space-y-6">
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Impact Measure</span>
                    <span className="font-mono text-sm bg-secondary/20 px-3 py-1 rounded-full">Blast Radius</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Growth Metric</span>
                    <span className="font-mono text-sm bg-secondary/20 px-3 py-1 rounded-full">Downloads / Stats</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Collaboration</span>
                    <span className="font-mono text-sm bg-secondary/20 px-3 py-1 rounded-full">Social Voting</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ecosystem Logic</span>
                    <span className="font-mono text-sm bg-secondary/20 px-3 py-1 rounded-full">Cross-Portability</span>
                  </li>
                </ul>
              </div>
              <div className="bg-primary/5 p-6">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-6">Kinetic Era (Protocol Labs)</div>
                <ul className="space-y-6">
                  <li className="flex items-center justify-between">
                    <span className="font-bold">Hardness Factor</span>
                    <span className="font-mono text-sm bg-primary/20 text-primary px-3 py-1 rounded-full font-bold">Task Complexity</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="font-bold">Impact Velocity</span>
                    <span className="font-mono text-sm bg-primary/20 text-primary px-3 py-1 rounded-full font-bold">Cross-Repo Bonus</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="font-bold">Peer Verification</span>
                    <span className="font-mono text-sm bg-primary/20 text-primary px-3 py-1 rounded-full font-bold">Review Depth</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="font-bold">Prioritization</span>
                    <span className="font-mono text-sm bg-primary/20 text-primary px-3 py-1 rounded-full font-bold">Repo Tiering</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem Section */}
      <section className="relative py-24 overflow-hidden bg-secondary/10 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-black font-heading">Seamless <span className="italic font-serif">Integration</span> Ecosystem</h2>
            <p className="text-xl text-muted-foreground">
              Connect the tools Protocol Labs uses. Link your GitHub to calculate complexity, settle rewards via Filecoin, and contribute to IPFS, libp2p, and Filecoin core repos effortlessly.
            </p>
          </div>
          <div className="flex items-center justify-center relative min-h-[400px]">
            <OrbitingEcosystem />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-32 bg-secondary/30 border-y border-border/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between mb-24">
            <div className="max-w-xl mb-10 md:mb-0">
              <h2 className="text-4xl md:text-5xl font-black font-heading mb-6">How It <span className="italic font-serif">Works</span></h2>
              <p className="text-xl text-muted-foreground">
                Four simple steps to turn your engineering contributions into tangible capital. No more manual invoicing—just merge code and get paid.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* SVG Connector Line */}
            <div className="hidden md:block absolute top-[4.5rem] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10 -z-10" />

            {[
              { title: "Authenticate", icon: <Github />, desc: "Link your GitHub and FIL Wallet." },
              { title: "Contribute", icon: <Briefcase />, desc: "Merge PRs in PL Ecosystem repos." },
              { title: "Evaluate", icon: <Star />, desc: "Value Score is calculated." },
              { title: "Earn", icon: <Wallet />, desc: "Claim tokens from the pool." }
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center group animate-slide-up" style={{ animationDelay: `${i * 0.15}s` }}>
                <div className="w-20 h-20 rounded-full bg-card border-2 border-border flex items-center justify-center mb-6 relative shadow-lg group-hover:border-primary group-hover:shadow-glow-lg transition-all duration-300">
                  <div className="w-10 h-10 text-foreground group-hover:text-primary transition-colors flex items-center justify-center">
                    {step.icon}
                  </div>
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-foreground text-background rounded-full flex items-center justify-center font-bold font-mono text-sm shadow-sm">
                    {i + 1}
                  </div>
                </div>
                <h4 className="text-xl font-bold font-heading mb-2">{step.title}</h4>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 bg-card relative overflow-hidden">
        <DotGrid
          className="absolute inset-0 opacity-10 z-0"
          baseColor="hsl(var(--foreground))"
          activeColor="hsl(var(--primary))"
          returnDuration={2}
          proximity={100}
        />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20 animate-slide-up">
            <h2 className="text-4xl md:text-5xl font-black font-heading">Trusted by <span className="italic font-serif">Maintainers</span></h2>
            <p className="text-xl text-muted-foreground mt-4">Real developers building the open architecture of tomorrow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                text: "Kinetic completely changed how we reward contributors in the libp2p ecosystem. It accurately identifies high-leverage tasks that would otherwise go unnoticed by simple stats.",
                author: "Sarah Drasner",
                handle: "@sarah_edo",
                role: "libp2p contributor"
              },
              {
                text: "The task complexity scoring is a game changer for Protocol Labs. It weighs a massive architectural refactor in go-ipfs significantly higher than thousands of simple typo fixes.",
                author: "Dan Abramov",
                handle: "@dan_abramov",
                role: "IPFS core"
              },
              {
                text: "I love that the funding is direct via FIL. No intermediary, no delays, no manual invoicing. I merge a PR in Filecoin, the MSTS score updates, and I see the rewards. Beautiful.",
                author: "Evan You",
                handle: "@youyuxi",
                role: "Filecoin contributor"
              }
            ].map((testimonial, i) => (
              <div key={i} className="bg-background/80 backdrop-blur-md p-8 rounded-4xl border border-border flex flex-col justify-between hover:-translate-y-2 transition-transform duration-300 ease-out-back shadow-md animate-slide-up" style={{ animationDelay: `${i * 0.15}s` }}>
                <div className="mb-8">
                  <div className="flex text-primary mb-4 gap-1">
                    <ShieldCheck className="w-5 h-5 fill-current opacity-80" />
                    <span className="text-sm font-semibold text-primary uppercase tracking-wider">Verified Contributor</span>
                  </div>
                  <p className="text-lg font-medium leading-relaxed italic text-foreground">"{testimonial.text}"</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-bold text-lg border border-border">
                    {testimonial.author.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold font-sans text-foreground">{testimonial.author}</h4>
                    <p className="text-sm text-muted-foreground font-mono">{testimonial.handle} • {testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-primary text-primary-foreground text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10 z-0"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10 space-y-8 flex flex-col items-center animate-slide-up">
          <h2 className="text-5xl md:text-7xl font-black font-heading drop-shadow-lg">Build the <span className="italic font-serif">Web3 Infrastructure</span>. <br /> Get Paid <span className="italic font-serif">Today</span>.</h2>
          <p className="text-xl md:text-2xl max-w-2xl opacity-90 font-medium">Join the elite rank of Protocol Labs contributors turning their commits into a sustainable career.</p>
          <Link
            href="/onboarding"
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
