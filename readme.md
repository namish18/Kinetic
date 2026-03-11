# Kinetic: The Protocol Labs Contribution Engine 🧠

Kinetic is a specialized funding platform designed specifically for **Protocol Labs contributors**. It moves beyond generic metrics to measure the true engineering complexity and ecosystem impact of work across the PL network (IPFS, Filecoin, libp2p, and more).

At the core of Kinetic is the **Multi-Signal Triangulation Score (MSTS)**—a formula specifically tuned to reward high-leverage engineering tasks, cross-repo collaboration, and code durability.

---

## 1. The Core Engine: Multi-Signal Triangulation Score (MSTS)

Instead of relying on simple commit counts, MSTS triangulates **6 independent signal layers** to determine a contributor's monthly payout.

### Layer 1: Task Complexity Score  (30% Weight)
*Our secret weapon. We measure how hard the problem actually was.*
- **How it works:** 
  - **Base:** Lines changed + files touched.
  - **Review Load:** Number of review cycles before merge (friction = complexity).
  - **Categorization:** Issues labeled `security`, `refactor`, or `feature` carry higher weights than standard `bug` or `doc` fixes.
  - **Competition:** How many other PRs were attempting to solve the same issue.
- **The Value:** Rewards the heavy lifters who tackle the hardest architectural challenges, not just "low-hanging fruit" gatherers.

### Layer 2: Code Survival Rate  (20% Weight)
*Measures code quality via historical churn analysis.*
- **How it works:** Calculates the percentage of original lines written by the contributor that remain unmodified in the codebase after 6-12 months.
- **The Value:** Proves your code was structurally sound and didn't require immediate rewriting.

### Layer 3: Issue Resolution Velocity  (20% Weight)
*Measures engineering responsiveness and critical path execution.*
- **How it works:** Tracks the time-to-close for critical path issues assigned to you, weighted by the repo's priority tier.
- **The Value:** Rewards engineers who unblock the ecosystem rapidly.

### Layer 4: PR Review Depth  (15% Weight)
*Measures the quality of peer-to-peer engineering collaboration.*
- **How it works:** Tracks the number of review comments, requested changes, and cycles a PR went through. High-quality, deep reviews indicate high-complexity tasks.
- **The Value:** Values the collaborative friction required to build consensus in distributed systems.

### Layer 5: Cross-Repo Contribution Bonus  (10% Weight)
*Rewards the ecosystem generalists.*
- **How it works:** A multiplier applied if a contributor submits merged code to 3 or more distinct repositories within the same month (e.g., contributing to both `go-ipfs` and `rust-libp2p`).
- **The Value:** Encourages knowledge sharing and reduces siloed development.

### Layer 6: Temporal Decay Weighting  (5% Weight)
*Favors recent, active maintenance over historical reputation.*
- **How it works:** Recent work is weighted more heavily than work from previous quarters.
- **The Value:** Keeps the funding flow focused on those actively pushing the frontier *today*.

---

## 2. The Validity Gate: Proof-of-Build

How do we prevent automated gaming of the system?

**Proof-of-Build:** 
No code is scored unless it comes with a **verified CI/CD execution trace**.
- **How it works:** Our backend queries the GitHub Actions / CircleCI API to verify that a specific run ID physically compiled and passed all integration tests with a `success` state.
- **The Math:** `Final Score = MSTS × MergeVerification_gate`. If there is no verified, successful build trace associated with the merge, the score is exactly `0`. 

---

## 3. The Vision: Meritocratic Ecosystem Funding

Kinetic ensures that Protocol Labs capital is distributed according to **runtime reality**, not social popularity. 

| Challenge | Old (Open Source) | Kinetic (Protocol Labs) |
|-----------|-------------------|--------------------------|
| **Impact Measurement** | Blast Radius (Downstream deps) | **Task Complexity Score** (Problem Hardness) |
| **Ecosystem View** | Cross-ecosystem portability | **Repo Tier Weighting** |
| **Collaboration** | Community quadratic voting | **PR Review Depth** (Engineering friction) |
| **Growth Metric** | NPM downloads | **Cross-Repo Contribution Bonus** |

**Welcome to Kinetic.** Powering the next generation of Protocol Labs contributors.

