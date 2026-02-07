---
name: uniclaw
description: Execute scoped Uniswap swaps through a Safe Smart Account with Zodiac Roles Modifier on Sepolia.
user-invocable: true
metadata: { "openclaw": { "emoji": "🦄", "requires": { "bins": ["node"] } } }
---

# Uniclaw – Scoped Uniswap Swaps

Use this skill when the user wants to manage a wallet, configure Safe/Roles addresses, save Uniswap pools, or execute token swaps through the Zodiac Roles Modifier.

## Setup Flow

On first use, run `init` to create an Ethereum wallet. Then `config` to set Safe and Roles Modifier addresses. Then `pool` to save a trading pool. Then `swap` to trade.

## Commands

### init – Create or load wallet
`node {baseDir}/index.js init`

Creates a new Ethereum wallet (User B) and saves it. If a wallet already exists, shows the address and balance. Tells the user to send Sepolia ETH for gas and to get Safe/Roles Modifier addresses from https://uniclaw.vercel.app/

### config – Set Safe and Roles Modifier addresses
`node {baseDir}/index.js config <SAFE_ADDRESS> <ROLES_MODIFIER_ADDRESS>`

### pool – Save a pool for swapping
`node {baseDir}/index.js pool <POOL_ADDRESS> <TOKEN_A> <TOKEN_B> [FEE]`

Fee tiers: 100 (0.01%), 500 (0.05%), 3000 (0.3%), 10000 (1%). Default: 3000.

### pools – List saved pools
`node {baseDir}/index.js pools`
or
`node {baseDir}/index.js pool list`

### swap – Execute a token swap
`node {baseDir}/index.js swap <TOKEN_IN> <TOKEN_OUT> <AMOUNT> [FEE]`
or natural language style:
`node {baseDir}/index.js swap <TOKEN_IN> <AMOUNT> to <TOKEN_OUT> [FEE]`

Executes a swap through the Roles Modifier using `execTransactionWithRole`. The fee tier is looked up from saved pools if not provided.

### balance – Check wallet ETH balance
`node {baseDir}/index.js balance`

Shows the wallet address and native ETH balance. If zero, suggests faucet URLs.

### transfer – Transfer ETH
`node {baseDir}/index.js transfer <TO_ADDRESS> <AMOUNT_ETH>`

Transfers native ETH from the skill wallet to another address.

### status – Show current state
`node {baseDir}/index.js status`

Shows wallet, config, pools, and Safe token balances.

## Examples

* User: "Create my wallet"
  Command: `node {baseDir}/index.js init`

* User: "Set the safe address to 0x587... and roles modifier to 0x9ed..."
  Command: `node {baseDir}/index.js config 0x58713F749cde4Fa9635C2f7a16A06F58065A582e 0x9ed68e5585D91B4F2C929E0d4c1EEDD99512cab9`

* User: "Add the WETH/USDC pool"
  Command: `node {baseDir}/index.js pool 0x6418eec70f50913ff0d756b48d32ce7c02b47c47 WETH USDC 10000`

* User: "Add the WETH/USDC pool at 0x6418eec70f50913ff0d756b48d32ce7c02b47c47 with fee 10000"
  Command: `node {baseDir}/index.js pool 0x6418eec70f50913ff0d756b48d32ce7c02b47c47 WETH USDC 10000`
  Note: Split the "TOKEN_A/TOKEN_B" pair into separate arguments. The pool address follows "at" and the fee follows "with fee".

* User: "Swap 1 USDC for WETH"
  Command: `node {baseDir}/index.js swap USDC 1 to WETH`

* User: "Swap USDC 0.10 to WETH"
  Command: `node {baseDir}/index.js swap USDC 0.10 to WETH`

* User: "Check my balance"
  Command: `node {baseDir}/index.js balance`

* User: "Send 0.01 ETH to 0xAbC..."
  Command: `node {baseDir}/index.js transfer 0xAbC...123 0.01`

* User: "Show my pools"
  Command: `node {baseDir}/index.js pool list`

* User: "List pools"
  Command: `node {baseDir}/index.js pool list`

* User: "What's the status?"
  Command: `node {baseDir}/index.js status`
