#!/usr/bin/env node

/**
 * Uniclaw Agent Skill – Scoped Uniswap swaps via Safe + Zodiac Roles Modifier
 *
 * Commands:
 *   init                          – Create or load Ethereum wallet (User B)
 *   config <SAFE> <ROLES>         – Save Safe and Roles Modifier addresses
 *   pool <ADDRESS> <TOKEN_A> <TOKEN_B> [FEE] – Save a pool for swapping
 *   pools                         – List saved pools
 *   swap <TOKEN_IN> <TOKEN_OUT> <AMOUNT> [FEE] – Execute a swap through Roles Modifier
 *   balance                       – Show ETH balance of the wallet
 *   transfer <TO> <AMOUNT>        – Transfer ETH from the wallet
 *   status                        – Show current configuration and balances
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// ── Paths ──
const DATA_DIR = __dirname;
const WALLET_FILE = path.join(DATA_DIR, "wallet.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const POOLS_FILE = path.join(DATA_DIR, "pools.json");

// ── Sepolia constants ──
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const CHAIN_ID = 11155111;
const SWAP_ROUTER = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";
const SWAP_ROLE_ID = 1;

// Well-known Sepolia tokens
const KNOWN_TOKENS = {
  WETH: { address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", decimals: 18 },
  USDC: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 },
  UNI: { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18 },
};

// ── ABIs ──
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const SWAP_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
];

const ROLES_MODIFIER_ABI = [
  "function execTransactionWithRole(address to, uint256 value, bytes data, uint8 operation, uint16 role, bool shouldRevert) returns (bool success)",
];

// ── Helpers ──

function loadJson(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {
    // ignore
  }
  return null;
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function loadWallet() {
  const data = loadJson(WALLET_FILE);
  if (!data || !data.privateKey) return null;
  return new ethers.Wallet(data.privateKey);
}

function loadConfig() {
  return loadJson(CONFIG_FILE) || {};
}

function loadPools() {
  return loadJson(POOLS_FILE) || [];
}

function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
}

function resolveToken(symbol) {
  const upper = symbol.toUpperCase();
  if (KNOWN_TOKENS[upper]) return KNOWN_TOKENS[upper];
  // Check saved pools for unknown tokens
  const pools = loadPools();
  for (const pool of pools) {
    if (pool.tokenA.symbol.toUpperCase() === upper) {
      return { address: pool.tokenA.address, decimals: pool.tokenA.decimals || 18 };
    }
    if (pool.tokenB.symbol.toUpperCase() === upper) {
      return { address: pool.tokenB.address, decimals: pool.tokenB.decimals || 18 };
    }
  }
  return null;
}

// ── Commands ──

async function cmdInit() {
  const existing = loadWallet();
  if (existing) {
    const provider = getProvider();
    const balance = await provider.getBalance(existing.address);
    console.log("Wallet already exists.");
    console.log("Address:", existing.address);
    console.log("ETH Balance:", ethers.formatEther(balance), "ETH");
    console.log("");
    console.log("If you need a new wallet, delete", WALLET_FILE);
    return;
  }

  // Create new wallet
  const wallet = ethers.Wallet.createRandom();
  saveJson(WALLET_FILE, {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic.phrase,
    createdAt: new Date().toISOString(),
  });

  console.log("New Ethereum wallet created!");
  console.log("Address:", wallet.address);
  console.log("Mnemonic:", wallet.mnemonic.phrase);
  console.log("");
  console.log("IMPORTANT: Send Sepolia ETH to this address to pay for gas:");
  console.log(`  ${wallet.address}`);
  console.log("");
  console.log("You can get free Sepolia ETH from:");
  console.log("  https://sepoliafaucet.com");
  console.log("  https://faucet.sepolia.dev");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Get the Safe and Roles Modifier addresses from the Uniclaw DApp:");
  console.log("     https://uniclaw.vercel.app/");
  console.log("  2. Set them here:");
  console.log(`     node ${path.basename(__filename)} config <SAFE_ADDRESS> <ROLES_MODIFIER_ADDRESS>`);
  console.log("  3. Have the Safe owner assign this wallet the swap role in the DApp UI.");
  console.log("  4. Save a pool and start swapping!");
  console.log("");
  console.log("Wallet saved to:", WALLET_FILE);
}

async function cmdConfig(safeAddress, rolesAddress) {
  if (!safeAddress || !rolesAddress) {
    console.error("Usage: config <SAFE_ADDRESS> <ROLES_MODIFIER_ADDRESS>");
    console.error("Example: config 0x58713F...582e 0x9ed68e...cab9");
    process.exit(1);
  }

  if (!ethers.isAddress(safeAddress)) {
    console.error("Invalid Safe address:", safeAddress);
    process.exit(1);
  }
  if (!ethers.isAddress(rolesAddress)) {
    console.error("Invalid Roles Modifier address:", rolesAddress);
    process.exit(1);
  }

  const config = loadConfig();
  config.safeAddress = safeAddress;
  config.rolesModifierAddress = rolesAddress;
  saveJson(CONFIG_FILE, config);

  console.log("Configuration saved!");
  console.log("Safe Address:", safeAddress);
  console.log("Roles Modifier:", rolesAddress);
}

async function cmdPool(poolAddress, symbolA, symbolB, fee) {
  if (!poolAddress || !symbolA || !symbolB) {
    console.error("Usage: pool <POOL_ADDRESS> <TOKEN_A_SYMBOL> <TOKEN_B_SYMBOL> [FEE]");
    console.error("Example: pool 0x6418...c47 WETH USDC 10000");
    process.exit(1);
  }

  if (!ethers.isAddress(poolAddress)) {
    console.error("Invalid pool address:", poolAddress);
    process.exit(1);
  }

  const feeTier = parseInt(fee || "3000", 10);
  if (![100, 500, 3000, 10000].includes(feeTier)) {
    console.error("Invalid fee tier. Use 100, 500, 3000, or 10000.");
    process.exit(1);
  }

  const upperA = symbolA.toUpperCase();
  const upperB = symbolB.toUpperCase();

  // Resolve token addresses
  const provider = getProvider();
  let tokenA = KNOWN_TOKENS[upperA];
  let tokenB = KNOWN_TOKENS[upperB];

  // If not known, try to read from the pool or require manual input
  if (!tokenA) {
    console.log(`Token ${upperA} not in known list. Trying to detect...`);
    // We'll store with defaults, user can update
    tokenA = { address: "unknown", decimals: 18 };
  }
  if (!tokenB) {
    console.log(`Token ${upperB} not in known list. Trying to detect...`);
    tokenB = { address: "unknown", decimals: 18 };
  }

  const pools = loadPools();

  // Check for duplicate
  const exists = pools.find(
    (p) => p.poolAddress.toLowerCase() === poolAddress.toLowerCase()
  );
  if (exists) {
    console.log("Pool already saved:", poolAddress);
    return;
  }

  pools.push({
    poolAddress,
    tokenA: { symbol: upperA, address: tokenA.address, decimals: tokenA.decimals },
    tokenB: { symbol: upperB, address: tokenB.address, decimals: tokenB.decimals },
    fee: feeTier,
    feeLabel: `${feeTier / 10000}%`,
    addedAt: new Date().toISOString(),
  });

  saveJson(POOLS_FILE, pools);
  console.log("Pool saved!");
  console.log(`  ${upperA}/${upperB} (${feeTier / 10000}% fee)`);
  console.log("  Pool:", poolAddress);
}

async function cmdPools() {
  const pools = loadPools();
  if (pools.length === 0) {
    console.log("No pools saved. Add one with:");
    console.log(`  node ${path.basename(__filename)} pool <ADDRESS> <TOKEN_A> <TOKEN_B> [FEE]`);
    return;
  }

  console.log(`Saved pools (${pools.length}):`);
  console.log("");
  for (const pool of pools) {
    console.log(`  ${pool.tokenA.symbol}/${pool.tokenB.symbol} – Fee: ${pool.feeLabel}`);
    console.log(`  Pool: ${pool.poolAddress}`);
    console.log("");
  }
}

async function cmdSwap(tokenInSymbol, tokenOutSymbol, amountStr, feeStr) {
  if (!tokenInSymbol || !tokenOutSymbol || !amountStr) {
    console.error("Usage: swap <TOKEN_IN> <TOKEN_OUT> <AMOUNT> [FEE]");
    console.error("Example: swap USDC WETH 1");
    process.exit(1);
  }

  // Load wallet
  const wallet = loadWallet();
  if (!wallet) {
    console.error("No wallet found. Run 'init' first.");
    process.exit(1);
  }

  // Load config
  const config = loadConfig();
  if (!config.safeAddress || !config.rolesModifierAddress) {
    console.error("Missing configuration. Run 'config <SAFE> <ROLES>' first.");
    process.exit(1);
  }

  // Resolve tokens
  const tokenIn = resolveToken(tokenInSymbol);
  const tokenOut = resolveToken(tokenOutSymbol);

  if (!tokenIn || tokenIn.address === "unknown") {
    console.error(`Unknown token: ${tokenInSymbol}. Add a pool with this token first.`);
    process.exit(1);
  }
  if (!tokenOut || tokenOut.address === "unknown") {
    console.error(`Unknown token: ${tokenOutSymbol}. Add a pool with this token first.`);
    process.exit(1);
  }

  // Find fee from saved pools or use provided
  let fee = parseInt(feeStr || "0", 10);
  if (!fee) {
    const pools = loadPools();
    const match = pools.find((p) => {
      const a = p.tokenA.symbol.toUpperCase();
      const b = p.tokenB.symbol.toUpperCase();
      const inUp = tokenInSymbol.toUpperCase();
      const outUp = tokenOutSymbol.toUpperCase();
      return (a === inUp && b === outUp) || (a === outUp && b === inUp);
    });
    if (match) {
      fee = match.fee;
    } else {
      console.error("No pool found for this pair. Specify fee tier or save a pool first.");
      process.exit(1);
    }
  }

  const provider = getProvider();
  const signer = wallet.connect(provider);
  const amountIn = ethers.parseUnits(amountStr, tokenIn.decimals);

  console.log("Executing swap through Roles Modifier...");
  console.log(`  ${amountStr} ${tokenInSymbol.toUpperCase()} → ${tokenOutSymbol.toUpperCase()}`);
  console.log(`  Fee tier: ${fee} (${fee / 10000}%)`);
  console.log(`  From wallet: ${wallet.address}`);
  console.log(`  Safe: ${config.safeAddress}`);
  console.log(`  Roles Modifier: ${config.rolesModifierAddress}`);
  console.log("");

  // Check ETH balance for gas
  const ethBal = await provider.getBalance(wallet.address);
  if (ethBal === 0n) {
    console.error("No ETH for gas. Fund your wallet first.");
    process.exit(1);
  }
  console.log("Gas balance:", ethers.formatEther(ethBal), "ETH");

  // Encode the swap calldata
  const routerIface = new ethers.Interface(SWAP_ROUTER_ABI);
  const swapCalldata = routerIface.encodeFunctionData("exactInputSingle", [
    {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      fee: fee,
      recipient: config.safeAddress,
      amountIn: amountIn,
      amountOutMinimum: 0n,
      sqrtPriceLimitX96: 0n,
    },
  ]);

  // Wrap in execTransactionWithRole
  const rolesIface = new ethers.Interface(ROLES_MODIFIER_ABI);
  const execCalldata = rolesIface.encodeFunctionData("execTransactionWithRole", [
    SWAP_ROUTER,   // to
    0n,            // value
    swapCalldata,  // data
    0,             // operation: Call
    SWAP_ROLE_ID,  // role
    true,          // shouldRevert
  ]);

  try {
    const tx = await signer.sendTransaction({
      to: config.rolesModifierAddress,
      data: execCalldata,
      value: 0n,
    });

    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait(1, 120000);

    if (receipt.status === 1) {
      console.log("✅ Swap succeeded!");
      console.log("  Block:", receipt.blockNumber);
      console.log("  Gas used:", receipt.gasUsed.toString());
    } else {
      console.log("❌ Swap reverted on-chain.");
    }
  } catch (err) {
    console.log("❌ Swap failed:", err.shortMessage || err.message);
  }
}

async function cmdStatus() {
  const wallet = loadWallet();
  const config = loadConfig();
  const pools = loadPools();

  console.log("═══ Uniclaw Status ═══");
  console.log("");

  // Wallet
  if (wallet) {
    const provider = getProvider();
    const ethBal = await provider.getBalance(wallet.address);
    console.log("Wallet:", wallet.address);
    console.log("ETH Balance:", ethers.formatEther(ethBal), "ETH");
  } else {
    console.log("Wallet: Not created. Run 'init'.");
  }
  console.log("");

  // Config
  if (config.safeAddress) {
    console.log("Safe:", config.safeAddress);
    console.log("Roles Modifier:", config.rolesModifierAddress || "Not set");
  } else {
    console.log("Config: Not set. Run 'config <SAFE> <ROLES>'.");
    console.log("Get the addresses from: https://uniclaw.vercel.app/");
  }
  console.log("");

  // Pools
  console.log(`Pools: ${pools.length} saved`);
  for (const pool of pools) {
    console.log(`  ${pool.tokenA.symbol}/${pool.tokenB.symbol} (${pool.feeLabel}) – ${pool.poolAddress}`);
  }

  // Token balances in Safe
  if (config.safeAddress) {
    console.log("");
    console.log("Safe token balances:");
    const provider = getProvider();
    for (const [symbol, token] of Object.entries(KNOWN_TOKENS)) {
      try {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        const bal = await contract.balanceOf(config.safeAddress);
        console.log(`  ${symbol}: ${ethers.formatUnits(bal, token.decimals)}`);
      } catch {
        console.log(`  ${symbol}: (error reading)`);
      }
    }
  }
}

async function cmdBalance() {
  const wallet = loadWallet();
  if (!wallet) {
    console.error("No wallet found. Run 'init' first.");
    process.exit(1);
  }

  const provider = getProvider();
  const balance = await provider.getBalance(wallet.address);

  console.log("Wallet:", wallet.address);
  console.log("ETH Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.log("");
    console.log("No ETH! Send Sepolia ETH to this address to pay for gas.");
    console.log("Faucets:");
    console.log("  https://sepoliafaucet.com");
    console.log("  https://faucet.sepolia.dev");
  }
}

async function cmdTransfer(toAddress, amountStr) {
  if (!toAddress || !amountStr) {
    console.error("Usage: transfer <TO_ADDRESS> <AMOUNT_ETH>");
    console.error("Example: transfer 0xAbC...123 0.01");
    process.exit(1);
  }

  if (!ethers.isAddress(toAddress)) {
    console.error("Invalid recipient address:", toAddress);
    process.exit(1);
  }

  const wallet = loadWallet();
  if (!wallet) {
    console.error("No wallet found. Run 'init' first.");
    process.exit(1);
  }

  const provider = getProvider();
  const signer = wallet.connect(provider);
  const amount = ethers.parseEther(amountStr);

  const balance = await provider.getBalance(wallet.address);
  console.log("Current balance:", ethers.formatEther(balance), "ETH");

  if (balance < amount) {
    console.error(`Insufficient balance. Have ${ethers.formatEther(balance)} ETH, need ${amountStr} ETH.`);
    process.exit(1);
  }

  console.log(`Transferring ${amountStr} ETH to ${toAddress}...`);

  try {
    const tx = await signer.sendTransaction({
      to: toAddress,
      value: amount,
    });

    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait(1, 60000);

    if (receipt.status === 1) {
      const newBalance = await provider.getBalance(wallet.address);
      console.log("✅ Transfer succeeded!");
      console.log("  Block:", receipt.blockNumber);
      console.log("  Gas used:", receipt.gasUsed.toString());
      console.log("  Remaining balance:", ethers.formatEther(newBalance), "ETH");
    } else {
      console.log("❌ Transfer reverted.");
    }
  } catch (err) {
    console.log("❌ Transfer failed:", err.shortMessage || err.message);
  }
}

// ── CLI Router ──

/**
 * Parse natural-language swap: "USDC 0.10 TO WETH" or "USDC 0.10 TO WETH 10000"
 * Returns { tokenIn, tokenOut, amount, fee } or null if not matching.
 */
function parseNaturalSwap(args) {
  // Look for "to" separator: <TOKEN_IN> <AMOUNT> to <TOKEN_OUT> [FEE]
  const lower = args.map((a) => a.toLowerCase());
  const toIdx = lower.indexOf("to");
  if (toIdx < 0) return null;

  // Before "to": token + amount (in either order)
  const before = args.slice(0, toIdx);
  const after = args.slice(toIdx + 1);
  if (before.length < 2 || after.length < 1) return null;

  let tokenIn, amount;
  // Detect which is the number
  if (!isNaN(parseFloat(before[0]))) {
    amount = before[0];
    tokenIn = before[1];
  } else {
    tokenIn = before[0];
    amount = before[1];
  }

  const tokenOut = after[0];
  const fee = after[1] || undefined;
  return { tokenIn, tokenOut, amount, fee };
}

async function main() {
  const args = process.argv.slice(2);
  const command = (args[0] || "").toLowerCase();

  switch (command) {
    case "init":
      await cmdInit();
      break;
    case "config":
      await cmdConfig(args[1], args[2]);
      break;
    case "pool":
      // Support "pool list" as alias for "pools"
      if (args[1] && args[1].toLowerCase() === "list") {
        await cmdPools();
      } else {
        await cmdPool(args[1], args[2], args[3], args[4]);
      }
      break;
    case "pools":
      await cmdPools();
      break;
    case "swap": {
      // Try natural language: swap USDC 0.10 to WETH [FEE]
      const natural = parseNaturalSwap(args.slice(1));
      if (natural) {
        await cmdSwap(natural.tokenIn, natural.tokenOut, natural.amount, natural.fee);
      } else {
        await cmdSwap(args[1], args[2], args[3], args[4]);
      }
      break;
    }
    case "balance":
      await cmdBalance();
      break;
    case "transfer":
      await cmdTransfer(args[1], args[2]);
      break;
    case "status":
      await cmdStatus();
      break;
    default:
      console.log("Uniclaw – Scoped Uniswap swaps via Safe + Zodiac Roles Modifier");
      console.log("");
      console.log("Commands:");
      console.log("  init                              Create or load Ethereum wallet");
      console.log("  config <SAFE> <ROLES>             Set Safe & Roles Modifier addresses");
      console.log("  pool <ADDR> <SYM_A> <SYM_B> [FEE] Save a pool for swapping");
      console.log("  pool list                         List saved pools");
      console.log("  pools                             List saved pools (alias)");
      console.log("  swap <IN> <OUT> <AMOUNT> [FEE]    Execute a swap through Roles Modifier");
      console.log("  swap <IN> <AMT> to <OUT> [FEE]    Natural language swap");
      console.log("  balance                           Show wallet ETH balance");
      console.log("  transfer <TO> <AMOUNT>            Transfer ETH to an address");
      console.log("  status                            Show configuration and balances");
      console.log("");
      console.log("DApp UI: https://uniclaw.vercel.app/");
      break;
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
