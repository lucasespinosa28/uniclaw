# 🦀 Uniclaw

Delegate scoped Uniswap swap permissions to an AI agent — without sharing your private keys.

**Safe Smart Account · Zodiac Roles Modifier · Uniswap · Sepolia Testnet**

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Sepolia](https://img.shields.io/badge/Network-Sepolia-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## What is Uniclaw?

Uniclaw lets an **Admin** deploy a [Safe](https://safe.global/) smart account, attach a [Zodiac Roles Modifier](https://github.com/gnosis/zodiac-modifier-roles), and create a tightly scoped role that permits **only** the `exactInputSingle` function on the Uniswap SwapRouter.

An **OpenClaw Agent** can then execute swaps on behalf of the Safe — without ever touching any other funds or contracts. All enforcement happens on-chain.

### Two Components

| Component | Description |
|-----------|-------------|
| **DApp** (this repo) | Next.js web app for admins to deploy Safes, configure roles, approve tokens, and find pools |
| **OpenClaw Skill** (`skill/uniclaw/`) | Lightweight Node.js CLI that an AI agent uses to initialize a wallet, save pools, and execute scoped swaps |

---

## How it Works

1. **Deploy Safe** — Admin creates a Safe smart account that holds all assets
2. **Attach Roles** — A Zodiac Roles Modifier is deployed and enabled as a Safe module
3. **Scope Permissions** — Admin scopes the SwapRouter target and allows only `exactInputSingle`
4. **Agent Swaps** — The OpenClaw agent executes swaps through the Roles Modifier

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (or Node.js 18+)
- A browser wallet (MetaMask, etc.) on Sepolia testnet
- Sepolia ETH for gas — get some from [Google Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) or [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)

### Install & Run

```bash
# Clone
git clone https://github.com/user/uniclaw.git
cd uniclaw

# Install dependencies
bun install

# Run the dev server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
bun run build
bun start
```

### Deploy

Deployed on Vercel at [uniclaw.vercel.app](https://uniclaw.vercel.app).

```bash
vercel --prod
```

---

## OpenClaw Agent Skill

The skill lives in `skill/uniclaw/` and is a standalone Node.js package (no TypeScript, no Bun required).

### Setup

```bash
cd skill/uniclaw
npm install
```

### Commands

| Command | Description |
|---------|-------------|
| `node index.js init` | Create or load an Ethereum wallet |
| `node index.js config <SAFE> <ROLES>` | Save Safe and Roles Modifier addresses |
| `node index.js pool <ADDR> <TOKEN_A> <TOKEN_B> [FEE]` | Save a pool for swapping |
| `node index.js pools` | List saved pools |
| `node index.js swap <IN> <OUT> <AMOUNT> [FEE]` | Execute a scoped swap |
| `node index.js balance` | Show wallet ETH balance |
| `node index.js transfer <TO> <AMOUNT>` | Transfer ETH |
| `node index.js status` | Show full configuration and balances |

### Example Flow

```bash
node index.js init
# → Created wallet 0xAbc...

node index.js config 0x5871...582e 0x9ed6...ab9
# → Saved config

node index.js pool 0x6418...c47 0xfFf9...6B14 0x1c7D...7238 10000
# → Pool saved

node index.js swap WETH USDC 0.001
# → Swap executed, tx: 0x...
```

A downloadable `.zip` of the skill is available at `/uniclaw.zip` on the deployed app.

---

## Architecture

```
Admin (Browser Wallet)
  │
  ├─ Deploys Safe ──────────────── Safe Smart Account
  │                                   │
  ├─ Deploys & enables ────────── Zodiac Roles Modifier
  │                                   │
  └─ Scopes role ──────────────── SwapRouter (exactInputSingle only)
                                      │
OpenClaw Agent                        │
  └─ execTransactionWithRole ─────────┘
       → Safe executes swap on Uniswap
```

---

## Security Model

- All assets live in the **Safe** — never in any delegate wallet
- The Zodiac Roles Modifier enforces **on-chain** that the agent can only call one specific function (`exactInputSingle`) on one specific contract (SwapRouter)
- Even a compromised agent key cannot drain funds, call other contracts, or change configuration
- Only the Safe owner can modify roles, revoke access, or withdraw assets

---

## Tech Stack

- **Next.js 16** (Turbopack) + React 19 + TypeScript
- **Safe Protocol Kit** v6 — smart account deployment & transactions
- **viem** + **wagmi** + **RainbowKit** — wallet connection & ABI encoding
- **Zodiac Roles Modifier** v1 — on-chain permission scoping
- **ethers.js** v6 — agent skill (Node.js)

## Key Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| Safe | `0x58713F749cde4Fa9635C2f7a16A06F58065A582e` |
| Roles Modifier | `0x9ed68e5585D91B4F2C929E0d4c1EEDD99512cab9` |
| SwapRouter02 | `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E` |
| WETH | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

---

## Project Structure

```
app/
  page.tsx                  # Landing page + admin dashboard
  Header.tsx                # Sticky header with wallet connect
  components/
    DeploySafe.tsx           # Step 1 — deploy Safe
    ConfigureRoles.tsx       # Step 2 — deploy & configure Roles Modifier
    ApproveRouter.tsx        # Token approval management
    PoolFinder.tsx           # Find Uniswap V3 pools
    ExecuteSwap.tsx          # Step 3 — execute swap (agent)
    SafeInfo.tsx             # Safe info & balances
  lib/
    safe.ts                  # Safe Protocol Kit helpers
    roles.ts                 # Zodiac Roles deployment & execution
    pools.ts                 # Uniswap V3 pool discovery
    constants.ts             # ABIs, addresses, selectors
    types.ts                 # Shared TypeScript types
skill/
  uniclaw/
    index.js                 # Agent skill (Node.js)
    SKILL.md                 # OpenClaw skill definition
    package.json
scripts/
  test-swap.ts               # Manual swap test script
  minimal-test-swap.ts       # Minimal swap test
```

---

## License

MIT
