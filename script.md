# Uniclaw — Video Script (~1 min)

> **Tone:** Casual, clear, confident. Imagine explaining to a dev friend.
> **Visuals:** Screen-record the DApp + terminal side by side.

---

## INTRO (0:00 – 0:10)

**[Show: Landing page with Uniclaw hero + crabot mascot]**

> "What if you could let an AI agent trade on Uniswap using your funds — without ever giving it your private keys? That's Uniclaw."

---

## THE PROBLEM (0:10 – 0:20)

**[Show: Briefly highlight the 3-column explainer cards]**

> "Today, if you want an agent to swap tokens for you, you either hand over your keys — which is terrifying — or you build some fragile approval flow. Uniclaw solves this with battle-tested smart contract infrastructure."

---

## HOW IT WORKS (0:20 – 0:40)

**[Show: Walk through the DApp steps — Deploy Safe → Configure Roles → Approve tokens]**

> "An admin deploys a Safe smart account, attaches a Zodiac Roles Modifier, and creates a tightly scoped role — allowing **only** the `exactInputSingle` function on the Uniswap SwapRouter. Then they assign that role to an agent wallet. The agent can now execute swaps on behalf of the Safe, but it physically cannot call any other function or touch any other contract."

---

## THE AGENT SKILL (0:40 – 0:52)

**[Show: Terminal running the OpenClaw skill commands — `init`, `config`, `pool`, `swap`]**

> "On the agent side, Uniclaw ships as an OpenClaw skill. The agent initializes its own wallet, receives the Safe and Roles Modifier addresses, saves a pool, and swaps — all through scoped on-chain permissions. No keys shared, no trust required."

---

## CLOSE (0:52 – 1:00)

**[Show: Back to landing page, zoom on Security Guarantees section]**

> "Safe smart accounts, Zodiac Roles, Uniswap — all audited, all on-chain. Uniclaw is the missing link between autonomous agents and DeFi. Try it on Sepolia today."

---

## RECORDING TIPS

- **Resolution:** 1920×1080, clean desktop, dark theme
- **Browser:** Hide bookmarks bar, use a clean profile
- **Terminal:** Bump font to 16pt so commands are readable
- **Wallet:** Have MetaMask connected on Sepolia with some ETH
- **Pre-load:** Have a Safe already deployed so you can show both a fresh deploy and the "Existing Safe detected" flow
- **Pacing:** Pause 1 second between scenes — easier to cut in editing
- **Music:** Lo-fi or ambient background, keep it subtle
