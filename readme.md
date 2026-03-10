# Kinetic: The Un-Gameable Contribution Algorithm 🧠

Kinetic is a decentralized funding platform designed to fundamentally change how open-source developers are rewarded. Instead of relying on vanity metrics (stars, forks) or whale-dominated voting pools, Kinetic measures **real-world impact, verified execution, and mathematical fairness**.

At the core of Kinetic is our proprietary algorithmic engine: the **Multi-Signal Triangulation Score (MSTS)** combined with **Proof-of-Build Verification** and **Dependency-Weighted Quadratic Funding**.

---

## 1. The Core Engine: Multi-Signal Triangulation Score (MSTS)

Instead of relying on a single metric, MSTS combines **5 independent signal layers** that must all mathematically agree. This triangulation makes gaming the system virtually impossible.

Each developer is scored out of 100 based on the weighted sum of these layers:

### Layer 1: Temporal Decay Weighting ⏳ (25% Weight)
*Most platforms count total stars ever. We weight by a recency curve.*
- **How it works:** Commits and PRs are decayed exponentially. A commit from last week retains 100% weight, while a commit from 3 years ago retains only ~10% weight ($`Score = \sum (metric\_value \times e^{-\lambda \times days\_since})`$).
- **The Value:** Rewards active maintainers keeping projects alive, not abandoned repos that are historically popular.

### Layer 2: Downstream Blast Radius 💥 (30% Weight)
*Don't just count who depends on you — count how deep the dependency tree goes.*
- **How it works:** A breadth-first search of the ecosystem dependency graph (e.g., npm). If React depends on your utility library, you get a weighted portion of React's massive user base.
- **The Value:** Depth 1 dependents = 1.0x, Depth 2 = 0.6x, Depth 3 = 0.3x. Properly values foundational infrastructure code.

### Layer 3: Code Survival Rate 🧬 (20% Weight)
*Measures code quality via historical churn analysis.*
- **How it works:** Calculates what percentage of original lines written by the developer are still alive and unmodified in the codebase after 1 year.
- **The Value:** If you wrote 1000 lines and 850 still exist untouched (85% survival), it proves your code was structurally sound and didn't need immediate rewriting.

### Layer 4: Issue Resolution Velocity ⚡ (15% Weight)
*Measures engineering responsiveness and critical bug fixes.*
- **How it works:** Tracks how fast critical bugs are fixed, weighted by the issue's severity.
- **The Value:** A P0 bug closed in 2 hours yields a massive score. A P3 feature request closed in 30 days yields a minimal score.

### Layer 5: Cross-Ecosystem Portability Index 🌐 (10% Weight)
*Does your code transcend its original language?*
- **How it works:** Detects if libraries are ported or heavily referenced across multiple package managers (npm, PyPI, Maven, crates.io).
- **The Value:** If a JS library gets ported to Python and Rust, it proves fundamental, cross-ecosystem architectural value.

---

## 2. The Validity Gate: Proof-of-Build (Anti-Sybil)

How do we stop people from creating thousands of fake GitHub accounts and pushing auto-generated code to inflate their scores?

**Proof-of-Build:** 
No code is scored unless it comes with a **verified CI/CD execution trace** (e.g., GitHub Actions, Vercel build logs).
- **How it works:** Our backend dynamically queries the GitHub Actions API to verify that a specific run ID physically compiled and executed with a `success` state.
- **The Math:** `Final Score = MSTS × ProofOfBuild_multiplier`. If there is no verified trace, the multiplier is exactly `0`. 
- **The Result:** Impossible to fake without actually burning compute and successfully compiling code.

---

## 3. The Distribution Engine: Dependency-Weighted Quadratic Funding (Anti-Whale)

How do we stop "Whales" (rich actors or massive single entities) from hijacking the funding pools?

We use a modified version of **Quadratic Funding**:
- **Standard Token Voting (Flawed):** 1 Whale with 100 tokens = 100 votes. 25 Community members with 4 tokens each = 100 votes. Total tie.
- **Kinetic Quadratic Funding:** We take the *square root* of the contributor's assigned MSTS impact score.
- **The Math:** 
  - Whale calculation: $\sqrt{100} = 10$. Match weight = $10^2 = 100$.
  - Community calculation: $25 \times \sqrt{4} = 50$. Match weight = $50^2 = 2500$.
- **The Result:** The community open-source project receives **96%** of the funding pool, completely obliterating the Whale's influence.

---

## Technical Summary 

| Challenge | Everyone Else Does | Kinetic Does |
|-----------|-------------------|--------------|
| **Measuring Impact** | GitHub stars, forks (highly gameable) | 5-Layer Triangulation (MSTS) |
| **Sybil Prevention** | Account age, Captchas | **Proof-of-Build:** Verified CI/CD traces required |
| **Fund Distribution** | Token voting (Whale Problem) | **Dependency-Weighted Quadratic Funding** |

**Welcome to Kinetic.** Where *runtime reality* dictates your rewards, not social popularity.
