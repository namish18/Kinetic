import Threads from "@/components/Threads";
import SplitText from "@/components/SplitText";
import BlurText from "@/components/BlurText";
import DotGrid from "@/components/DotGrid";
import LogoLoop from "@/components/LogoLoop";
import OrbitImages from "@/components/OrbitImages";
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
    { node: <TickerItem text="Paid 2.4 FLOW to @alice for PR #124 on React" /> },
    { node: <TickerItem text="Paid 5.1 FLOW to @bob for Issue #59 on Nextjs" /> },
    { node: <TickerItem text="Paid 1.2 FLOW to @charlie for PR #802 on Tailwind" /> },
    { node: <TickerItem text="Paid 8.9 FLOW to @dave for Issue #11 on Kubernetes" /> },
    { node: <TickerItem text="Paid 3.0 FLOW to @eve for PR #42 on PyTorch" /> },
    { node: <TickerItem text="Paid 0.5 FLOW to @frank for PR #77 on Vue" /> },
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
            <span>Now on the Flow Blockchain Testnet</span>
          </div>

          <div className="space-y-6 flex flex-col items-center">
            <BlurText
              text="Fund the code that runs the world."
              delay={100}
              animateBy="words"
              direction="top"
              className="text-primary font-mono font-bold tracking-[0.1em] uppercase text-2xl md:text-3xl justify-center w-full"
            />

            <SplitText
              text="Your Commits Deserve Capital"
              className="text-[64px] md:text-[140px] font-black font-sans tracking-[-0.08em] leading-[0.85] text-foreground drop-shadow-sm max-w-[1250px] px-4"
              delay={40}
              duration={0.9}
              ease="power4.out"
              splitType="chars"
              from={{ opacity: 0, scale: 0.9, y: 120 }}
              to={{ opacity: 1, scale: 1, y: 0 }}
            />
          </div>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl font-normal animate-fade-in opacity-80 leading-relaxed tracking-tight" style={{ animationDelay: '0.4s' }}>
            Transform your open-source contributions into tangible assets with Kinetic. Verified commits, automated bounties, and decentralized funding.
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
            <h2 className="text-4xl md:text-5xl font-black font-heading">The Open-Source Funding Pipeline</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We analyze your impact algorithmically and compensate you through smart contracts.
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
              <h3 className="text-2xl font-bold font-heading mb-3">Contribution Algorithm</h3>
              <p className="text-muted-foreground leading-relaxed">
                Our transparent, open-source algorithm ranks contributions based on dependency trees, impact velocity, and peer reviews to calculate your fair Value Score asynchronously.
              </p>
            </div>

            <div className="bg-card/60 backdrop-blur-md border border-border p-8 rounded-4xl shadow-md dark:shadow-glow hover:-translate-y-2 transition-transform duration-300 ease-out-back animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Award className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold font-heading mb-3">Flow Payout</h3>
              <p className="text-muted-foreground leading-relaxed">
                Tokens stream directly into your wallet via Flow blockchain smart contracts. Fast finalized payouts, zero hidden fees, and entirely autonomous allocation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem Section */}
      <section className="relative py-32 bg-card overflow-hidden border-y border-border">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-4xl md:text-5xl font-black font-heading">The Un-Gameable Engine</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our Multi-Signal Triangulation Score (MSTS) evaluates 5 independent signal layers that must all mathematically agree. Fake stars and bots won't save you here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-16">
            {[
              { title: "Temporal Decay", percent: "25%", desc: "Commits are weighted by a recency curve. Active code gets paid." },
              { title: "Blast Radius", percent: "30%", desc: "Breadth-first search of your downstream dependency tree." },
              { title: "Code Survival", percent: "20%", desc: "Code churn analysis. Did your lines survive untouched for a year?" },
              { title: "Issue Velocity", percent: "15%", desc: "How fast you close severe issues, weighted by priority label." },
              { title: "Portability", percent: "10%", desc: "Cross-ecosystem adoption tracking across npm, PyPI, and Crates." }
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
                No code is scored unless accompanied by a verified CI/CD execution trace. We dynamically query GitHub Actions and Vercel logs to mathematically prove your code compiled and ran successfully. No trace? Multiplier = 0.
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

          <div className="bg-foreground text-background border border-border rounded-3xl p-8 relative overflow-hidden flex flex-col md:flex-row-reverse items-center justify-between gap-8">
            <div className="md:w-2/3 space-y-4">
              <div className="inline-flex items-center space-x-2 bg-background/20 text-secondary px-3 py-1 rounded-full text-sm font-bold mb-2">
                <Wallet className="w-4 h-4" />
                <span>Anti-Whale Protocol</span>
              </div>
              <h3 className="text-3xl font-black">Dependency-Weighted Quadratic Funding</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Token voting is fundamentally broken because it empowers "Whales". We use Quadratic Funding, but replace token volume with the square root of your MSTS Impact Score. A vibrant community of small developers will mathematically outcompete a single massive whale every single time.
              </p>
            </div>
            <div className="md:w-1/3 bg-card border border-border p-5 rounded-2xl font-mono text-sm overflow-hidden text-muted-foreground w-full shadow-inner">
              <div className="text-blue-500 mb-2">{`> Compute Distribution...`}</div>
              <div className="opacity-80">{`Whale Score: 100 → w: 100`}</div>
              <div className="opacity-80">{`Comm Score: 100 → w: 2500`}</div>
              <div className="text-secondary font-bold mt-4">{`Whale Share: 3.8%`}</div>
              <div className="text-green-500 font-bold mt-2">{`Community Share: 96.2%`}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem Section */}
      <section className="relative py-24 overflow-hidden bg-secondary/10 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-black font-heading">Seamless Integration Ecosystem</h2>
            <p className="text-xl text-muted-foreground">
              Connect the tools you already use. Link your GitHub to mint your DID, settle bounties via Stripe, sequence data on Filecoin, and power governance with Protocol Labs architecture.
            </p>
          </div>
          <div className="flex items-center justify-center relative min-h-[400px]">
            <OrbitImages
              images={[
                <Github className="w-12 h-12 text-foreground" />,
                "https://cryptologos.cc/logos/filecoin-fil-logo.svg?v=040",
                "https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg",
                <Fingerprint className="w-12 h-12 text-primary" />,
                "https://cdn.brandfetch.io/idf59FzkOR/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdO279I",
              ]}
              shape="circle"
              radius={140}
              rotation={-15}
              duration={20}
              itemSize={60}
              responsive={false}
              direction="normal"
              fill={true}
              showPath={true}
              pathColor="hsl(var(--primary))"
              pathWidth={1}
              centerContent={
                <div className="w-24 h-24 rounded-full bg-background border border-border shadow-glow flex items-center justify-center z-20">
                  <span className="font-heading font-bold text-2xl tracking-tighter">Kinetic</span>
                </div>
              }
            />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-32 bg-secondary/30 border-y border-border/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between mb-24">
            <div className="max-w-xl mb-10 md:mb-0">
              <h2 className="text-4xl md:text-5xl font-black font-heading mb-6">How It Works</h2>
              <p className="text-xl text-muted-foreground">
                Four simple steps to turn your open-source contributions into tangible capital. No more begging for donations—just push code and get paid.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* SVG Connector Line */}
            <div className="hidden md:block absolute top-[4.5rem] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10 -z-10" />

            {[
              { title: "Authenticate", icon: <Github />, desc: "Link your GitHub and Wallet." },
              { title: "Contribute", icon: <Briefcase />, desc: "Merge PRs in open-source." },
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

      {/* Stats Section */}
      <section className="py-24 bg-background relative border-b border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="flex flex-col items-center text-center pt-8 md:pt-0">
              <span className="text-6xl font-black font-mono text-foreground drop-shadow-lg shadow-primary hover:shadow-glow-lg animate-glow-pulse mb-4">$4.2M</span>
              <span className="text-lg font-medium text-muted-foreground uppercase tracking-widest break-words text-center">Total Paid Out</span>
            </div>
            <div className="flex flex-col items-center text-center pt-12 md:pt-0">
              <span className="text-6xl font-black font-mono text-foreground drop-shadow-lg shadow-primary hover:shadow-glow-lg animate-glow-pulse mb-4" style={{ animationDelay: '0.4s' }}>1,409</span>
              <span className="text-lg font-medium text-muted-foreground uppercase tracking-widest break-words text-center">Projects Funded</span>
            </div>
            <div className="flex flex-col items-center text-center pt-12 md:pt-0">
              <span className="text-6xl font-black font-mono text-foreground drop-shadow-lg shadow-primary hover:shadow-glow-lg animate-glow-pulse mb-4" style={{ animationDelay: '0.8s' }}>8,024</span>
              <span className="text-lg font-medium text-muted-foreground uppercase tracking-widest break-words text-center">Devs Rewarded</span>
            </div>
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
            <h2 className="text-4xl md:text-5xl font-black font-heading">Trusted by Maintainers</h2>
            <p className="text-xl text-muted-foreground mt-4">Real developers building the open architecture of tomorrow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                text: "Kinetic completely changed how I maintain my libraries. Before, it was weekend charity. Now, my commits actually pay my rent. It's decentralized funding done right.",
                author: "Sarah Drasner",
                handle: "@sarah_edo",
                role: "Vue Core Team"
              },
              {
                text: "The contribution algorithm is shockingly good. It accurately weighs a massive architectural refactor higher than thousands of simple typo fixes. Finally, a fair system.",
                author: "Dan Abramov",
                handle: "@dan_abramov",
                role: "React Ecosystem"
              },
              {
                text: "I love that the funding is direct via Flow. No intermediary taking a 30% cut, no delays, no manual invoicing. I merge a PR, the value score updates, I withdraw. Beautiful.",
                author: "Evan You",
                handle: "@youyuxi",
                role: "Creator of Vite"
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
          <h2 className="text-5xl md:text-7xl font-black font-heading drop-shadow-lg">Build the Future. <br /> Get Paid Today.</h2>
          <p className="text-xl md:text-2xl max-w-2xl opacity-90 font-medium">Join thousands of developers turning their open-source commits into a sustainable career.</p>
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
