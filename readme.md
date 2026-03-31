# Kinetic

**Kinetic** is a meritocratic funding platform purpose-built for Protocol Labs contributors. It replaces vanity metrics with a mathematically rigorous scoring engine that measures the true engineering complexity and ecosystem impact of open-source work across the Protocol Labs network, including IPFS, Filecoin, libp2p, and related projects.

At its core lies the **Multi-Signal Triangulation Score (MSTS)**, a composite formula specifically tuned to reward high-leverage engineering tasks, cross-repository collaboration, and durable, production-grade code.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [How to Run the Project](#how-to-run-the-project)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Flow Blockchain Setup](#flow-blockchain-setup)
- [Features](#features)
  - [Multi-Signal Triangulation Score](#multi-signal-triangulation-score)
  - [Proof-of-Build Verification](#proof-of-build-verification)
  - [Decentralized Identity](#decentralized-identity)
  - [Autonomous FLOW Payouts](#autonomous-flow-payouts)
- [Sponsor Integration](#sponsor-integration)
  - [Flow Blockchain](#flow-blockchain)
  - [Filecoin Foundation](#filecoin-foundation)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [License](#license)

---

## Architecture Overview

Kinetic is organized as a monorepo consisting of three principal layers:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16, React 19, TailwindCSS 4, GSAP | Interactive dashboard, contributor onboarding, and landing pages |
| **Backend** | Node.js, Express, MongoDB, Passport (GitHub OAuth) | REST API, GitHub webhook processing, contribution scoring engine |
| **Blockchain** | Flow Testnet, Cadence smart contracts, FCL | On-chain treasury management, payout proposals, and multi-sig approvals |

---

## How to Run the Project

### Prerequisites

Ensure the following tools are installed on your system before proceeding:

- **Node.js** v20 or later
- **npm** v9 or later
- **MongoDB** (local instance or a hosted service such as MongoDB Atlas)
- **Git**
- **Flow CLI** (required only for smart contract development and deployment)

You will also need the following external accounts and credentials:

- A **GitHub OAuth Application** (Client ID and Client Secret)
- A **MongoDB** connection string
- A **Flow Testnet** account (for blockchain interactions)

### Backend Setup

1. Clone the repository and navigate to the backend directory:

   ```bash
   git clone <repository-url>
   cd kinetic/backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the `backend/` directory with the following variables:

   ```env
   PORT=5000
   MONGODB_URI=<your-mongodb-connection-string>
   GITHUB_CLIENT_ID=<your-github-oauth-client-id>
   GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>
   SESSION_SECRET=<a-secure-random-string>
   JWT_SECRET=<a-secure-random-string>
   FRONTEND_URL=http://localhost:3000
   FLOW_ADDRESS=<your-flow-testnet-account-address>
   FLOW_PRIVATE_KEY=<your-flow-testnet-private-key>
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:5000`. A health check endpoint is accessible at `http://localhost:5000/health`.

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd kinetic/frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the `frontend/` directory with the following variables:

   ```env
   NEXT_PUBLIC_FLOW_ADDRESS=<your-flow-testnet-contract-address>
   NEXT_PUBLIC_FLOW_NETWORK=testnet
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`.

### Flow Blockchain Setup

The smart contract layer uses Cadence, the native language for the Flow blockchain. To deploy or modify contracts:

1. Navigate to the Flow directory:

   ```bash
   cd kinetic/backend/flow
   ```

2. To deploy the `KineticPayout` contract to the Flow Testnet:

   ```bash
   flow project deploy --network=testnet
   ```

3. To run Cadence scripts (read-only operations):

   ```bash
   flow scripts execute cadence/scripts/get_balance.cdc --network=testnet
   ```

4. To submit transactions (state-changing operations):

   ```bash
   flow transactions send cadence/transactions/propose_payout.cdc --network=testnet
   ```

Refer to the [Flow CLI Documentation](https://developers.flow.com/tools/flow-cli) for additional commands and configuration options.

---

## Features

### Multi-Signal Triangulation Score

Rather than relying on simplistic commit counts, Kinetic triangulates six independent signal layers to determine a contributor's monthly payout allocation:

| Layer | Weight | Signal |
|-------|--------|--------|
| **Task Complexity** | 30% | Log-scaled lines changed, files touched, review cycles, and issue categorization |
| **Code Survival Rate** | 20% | Percentage of original lines remaining unmodified after 6-12 months |
| **Issue Resolution Velocity** | 20% | Time-to-close for critical path issues, weighted by repository priority tier |
| **PR Review Depth** | 15% | Review comment density, requested changes, and consensus-building cycles |
| **Cross-Repo Contribution** | 10% | Multiplier for contributors with merged code in three or more distinct repositories |
| **Temporal Decay** | 5% | Recency weighting that favors active, ongoing maintenance over historical reputation |

### Proof-of-Build Verification

All scored contributions are gated behind a verification layer called **Proof-of-Build**. No code receives a score unless it is accompanied by a verified CI/CD execution trace. The backend queries the GitHub Actions API to confirm that a specific run ID compiled successfully and passed all integration tests. If no verified build trace exists for a merged contribution, its final score is set to zero.

### Decentralized Identity

Contributors authenticate via GitHub OAuth. Upon first login, Kinetic mints a **Decentralized Identifier (DID)** using the `key-did-provider-ed25519` standard from the Ceramic / Protocol Labs stack. DID documents are stored on an in-process Helia IPFS node. This cryptographic identity binds a contributor's commits, pull requests, and issues as verifiable credentials.

### Autonomous FLOW Payouts

Payout distribution is handled entirely on-chain through the `KineticPayout` Cadence smart contract deployed on the Flow Testnet. The contract supports:

- **Treasury Management** -- Organizations deposit FLOW tokens into a managed treasury vault.
- **Payout Proposals** -- Authorized signers submit payout batches specifying recipient addresses and amounts.
- **Multi-Signature Approvals** -- Payouts require a configurable threshold of approvals from authorized signers before execution.
- **Direct Execution** -- Once the approval threshold is met, funds are disbursed directly to contributor wallets.

The frontend integrates with the Flow Client Library (FCL) for wallet authentication, balance queries, and transaction signing. Contributors can connect their Flow wallet, view pending payouts, and approve or execute distributions directly from the dashboard.

---

## Sponsor Integration

Kinetic has been built in direct collaboration with its hackathon sponsors, integrating their technologies as foundational infrastructure rather than superficial branding.

### Flow Blockchain

Flow serves as the settlement layer for all contributor payouts. The integration spans the full stack:

- **Smart Contracts**: The `KineticPayout.cdc` contract, written in Cadence, manages treasury deposits, payout proposals, multi-signature approvals, and token disbursement on the Flow Testnet.
- **Backend Services**: The `flowService.js` module handles server-side interactions with the Flow network, including transaction construction and submission.
- **Frontend Integration**: The FCL library is configured in `src/lib/flow.ts` to connect to the Flow Testnet access node and discovery wallet. All read operations (treasury balance, payout details, signer lists) and write operations (submit, approve, execute payouts, deposit funds) are implemented as typed wrapper functions.
- **Visual Presence**: The Flow logo is prominently featured in the `OrbitingEcosystem` component on the landing page, orbiting the central Kinetic icon alongside other ecosystem partners.

### Filecoin Foundation

Filecoin Foundation's presence is reflected in both the product design and the platform's target audience:

- **Target Ecosystem**: Kinetic is designed to measure and reward contributions to Protocol Labs repositories, which include the Filecoin network, IPFS, libp2p, and related infrastructure.
- **Visual Presence**: The Filecoin Foundation logo appears in the `OrbitingEcosystem` component on the landing page, representing the broader Protocol Labs ecosystem that Kinetic serves.
- **DID Infrastructure**: The Decentralized Identifier system, powered by the Ceramic / Protocol Labs stack, reflects the decentralized identity principles championed by the Filecoin ecosystem.

---

## Project Structure

```
kinetic/
  backend/
    config/             # Database connection and Passport OAuth configuration
    flow/
      cadence/
        contracts/      # KineticPayout.cdc smart contract
        scripts/        # Read-only Cadence scripts
        transactions/   # State-changing Cadence transactions
        tests/          # Cadence integration tests
      flow.json         # Flow project configuration
    models/             # Mongoose data models
    routes/             # Express route handlers (auth, contribution, kinetic, repo, webhook)
    services/           # Core business logic (contribution scoring, DID, Flow, kinetic mechanisms)
    server.js           # Application entry point
  frontend/
    src/
      app/              # Next.js App Router pages (dashboard, bounties, docs, voting, onboarding)
      components/       # Reusable UI components (PillNav, LogoLoop, OrbitingEcosystem, etc.)
      lib/              # Shared utilities and Flow blockchain client (flow.ts)
  contribution_algo.md  # Detailed specification of the contribution scoring algorithm
  readme.md             # This file
```

---

## API Reference

The backend exposes the following primary endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/github` | Initiate GitHub OAuth authentication flow |
| `GET` | `/api/auth/github/callback` | OAuth callback; creates DID on first login |
| `GET` | `/api/auth/me` | Retrieve current user profile (JWT required) |
| `GET` | `/api/auth/did/:username` | Resolve a DID by GitHub username (public) |
| `GET` | `/api/auth/did-resolve/self` | Re-resolve the authenticated user's DID (JWT required) |
| `PUT` | `/api/auth/wallet` | Link a Flow wallet address to the authenticated account (JWT required) |
| `GET` | `/api/auth/logout` | Terminate the current session |
| `GET` | `/health` | Health check endpoint |

Additional routes are available under `/api/contribution`, `/api/kinetic`, `/api/org`, and `/api/webhook` for contribution scoring, kinetic mechanism queries, organization repository management, and GitHub webhook processing, respectively.

---

## License

This project is licensed under the ISC License. See the repository for details.
