# Uniclaw — Video Script (~2:18)

> **Tone:** Casual, clear, confident. Imagine explaining to a dev friend.
> **Visuals:** Screen-record the DApp + terminal side by side.

---

## INTRO (0:00 – 0:20)

**[Show: Landing page with Uniclaw hero + crabot mascot]**

> "What if an AI agent could trade on Uniswap with your funds — without ever getting your private keys? No shared seed phrases, no off-chain workarounds. Just smart contracts enforcing every rule on-chain. That's Uniclaw — and I'm going to show you how it works."


---

## THE PROBLEM (0:20 – 0:45)

**[Show: Briefly highlight the 3-column explainer cards, zoom into each one]**

> "Today, letting an agent trade for you means handing over your keys — which means it can do anything with your money — or building some fragile off-chain approval flow that breaks the moment something goes wrong. Either way, if the agent gets compromised, your funds are gone. Uniclaw takes a totally different approach. Instead of trusting the agent, we use Safe multisigs and Zodiac Roles to enforce permissions directly on-chain. The agent physically cannot exceed what you allow."


---

## HOW IT WORKS (0:45 – 1:25)

**[Show: Walk through the DApp steps — Deploy Safe → Configure Roles → Approve tokens → Pool Finder]**

> "Here's the flow. The admin connects their wallet and deploys a Safe smart account — that's where all the assets live, locked behind multisig security. Then they deploy a Zodiac Roles Modifier and enable it as a module on the Safe. This Roles Modifier is the key piece — it sits between the agent and the Safe, acting as a permission gate. The admin scopes a role that allows only one function — `exactInputSingle` — on one contract — the Uniswap SwapRouter. Nothing else. Then they assign that role to the agent's wallet. The agent can swap, but it cannot transfer tokens, change configuration, or call anything outside that single function."


---

## THE AGENT SKILL (1:25 – 1:55)

**[Show: Terminal running the OpenClaw skill commands — `init`, `config`, `pool`, `swap`, `balance`]**

> "On the agent side, Uniclaw ships as an OpenClaw skill — a lightweight Node.js package any AI agent can call. The agent runs `init` to create its own Ethereum wallet. The admin provides the Safe and Roles Modifier addresses via `config`. Then the agent saves a Uniswap pool with `pool`, and from that point on it can call `swap` to trade — all routed through `execTransactionWithRole` on the Roles Modifier. It can also check balances and show its full status. Every single swap goes through the on-chain permission check. No keys shared, no trust required."


---

## CLOSE (1:55 – 2:18)

**[Show: Back to landing page, zoom on Security Guarantees section, then the Architecture diagram]**

> "Let's talk security. Safe, Zodiac Roles, Uniswap — all battle-tested, all audited, all on-chain. Assets never leave the Safe. Even if the agent's key gets compromised, the worst it can do is swap tokens that are already approved — it cannot drain the wallet, it cannot call arbitrary contracts, it cannot change its own permissions. Uniclaw is the missing link between autonomous agents and DeFi. It's live on Sepolia right now — try it today."

---

## RECORDING TIPS

- **Resolution:** 1920×1080, clean desktop, dark theme
- **Browser:** Hide bookmarks bar, use a clean profile
- **Terminal:** Bump font to 16pt so commands are readable
- **Wallet:** Have MetaMask connected on Sepolia with some ETH
- **Pre-load:** Have a Safe already deployed so you can show both a fresh deploy and the "Existing Safe detected" flow
- **Pacing:** Pause 1 second between scenes — easier to cut in editing
- **Music:** Lo-fi or ambient background, keep it subtle
