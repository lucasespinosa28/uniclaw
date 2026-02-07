#!/usr/bin/env bun
/**
 * Test swap script – executes a USDC → WETH swap through the Roles Modifier
 * as the assigned User B, using a private key (no browser wallet needed).
 *
 * Configure via .env file (see .env.example):
 *   USER_B_PRIVATE_KEY=0x...
 *   ROLES_MODIFIER_ADDRESS=0x...
 *   SAFE_ADDRESS=0x...
 *   SWAP_AMOUNT=1            # USDC amount (optional, default 1)
 *   SWAP_FEE_TIER=3000       # 100 | 500 | 3000 | 10000 (optional, default 3000)
 *
 * Usage:
 *   bun scripts/test-swap.ts
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  formatEther,
  decodeErrorResult,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// ──────────────────────────────────────────────
// Contract addresses (Sepolia)
// ──────────────────────────────────────────────

const UNISWAP_SWAP_ROUTER = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E' as const;
const USDC_SEPOLIA = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238' as const;
const WETH_SEPOLIA = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as const;
const POOL_ADDRESS = '0x6418eec70f50913ff0d756b48d32ce7c02b47c47' as const;
const SWAP_ROLE_ID = 1;
const DEFAULT_FEE_TIER = 10000; // 1% pool

// ──────────────────────────────────────────────
// ABIs (minimal)
// ──────────────────────────────────────────────

const SWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

const ROLES_MODIFIER_ABI = [
  {
    name: 'execTransactionWithRole',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'role', type: 'uint16' },
      { name: 'shouldRevert', type: 'bool' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const;

/** Roles Modifier v1 custom errors for decoding reverts */
const ROLES_ERRORS_ABI = [
  { type: 'error', name: 'NoMembership', inputs: [] },
  {
    type: 'error',
    name: 'TargetAddressNotAllowed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'FunctionNotAllowed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ModuleTransactionFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ArraysDifferentLength',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SetUpModulesAlreadyCalled',
    inputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const SAFE_ABI = [
  {
    name: 'getModules',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'isModuleEnabled',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'module', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const ROLES_VIEW_ABI = [
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'avatar',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'target',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'members',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'uint16' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const POOL_ABI = [
  {
    name: 'liquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint128' }],
  },
  {
    name: 'slot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
] as const;

// ──────────────────────────────────────────────
// Load env vars (bun auto-loads .env)
// ──────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    console.error('Create a .env file — see .env.example');
    process.exit(1);
  }
  return val;
}

const privateKey = requireEnv('USER_B_PRIVATE_KEY') as Hex;
const rolesModifierAddress = requireEnv('ROLES_MODIFIER_ADDRESS') as Hex;
const safeAddress = requireEnv('SAFE_ADDRESS') as Hex;
const amountStr = process.env.SWAP_AMOUNT || '1';
const feeTier = parseInt(process.env.SWAP_FEE_TIER || String(DEFAULT_FEE_TIER), 10);

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  // Derive account from private key
  const account = privateKeyToAccount(
    privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`,
  );

  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Uniclaw – Test Swap (USDC → WETH)     ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log();
  console.log('Network:          Sepolia');
  console.log('User B:          ', account.address);
  console.log('Roles Modifier:  ', rolesModifierAddress);
  console.log('Safe:            ', safeAddress);
  console.log('Amount:          ', amountStr, 'USDC');
  console.log('Fee tier:        ', feeTier, `(${feeTier / 10000}%)`);
  console.log();

  // Create clients
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });

  // ── Pre-flight checks ──

  // 1. Check User B ETH balance (for gas)
  const ethBalance = await publicClient.getBalance({ address: account.address });
  console.log('User B ETH balance:', formatEther(ethBalance));
  if (ethBalance === BigInt(0)) {
    console.error('❌ User B has no ETH for gas. Fund the account first.');
    process.exit(1);
  }

  // 2. Check Safe USDC balance (the Safe holds the tokens)
  const safeUsdcBalance = await publicClient.readContract({
    address: USDC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [safeAddress],
  });
  console.log('Safe USDC balance:', formatUnits(safeUsdcBalance, 6));

  const amountIn = parseUnits(amountStr, 6); // USDC has 6 decimals

  if (safeUsdcBalance < amountIn) {
    console.error(
      `❌ Safe has insufficient USDC. Has ${formatUnits(safeUsdcBalance, 6)}, need ${amountStr}.`,
    );
    process.exit(1);
  }

  // 3. Check Safe WETH balance before swap
  const safeWethBefore = await publicClient.readContract({
    address: WETH_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [safeAddress],
  });
  console.log('Safe WETH balance (before):', formatEther(safeWethBefore));

  // 4. Check USDC allowance: Safe → SwapRouter
  //    NOTE: The Safe must have approved the SwapRouter to spend USDC.
  //    If not, the swap will revert. This approval should be done by the
  //    Safe owner (Admin) before running this script.
  const usdcAllowance = await publicClient.readContract({
    address: USDC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [safeAddress, UNISWAP_SWAP_ROUTER],
  });
  console.log('USDC allowance (Safe→Router):', formatUnits(usdcAllowance, 6));

  if (usdcAllowance < amountIn) {
    console.warn(
      '⚠️  USDC allowance is less than swap amount.',
      'The Safe owner needs to approve the SwapRouter to spend USDC.',
      'You can do this via the Safe UI or a separate script.',
    );
    console.warn('Proceeding anyway (tx may revert)...');
  }

  // ── Diagnostic checks ──
  console.log();
  console.log('── Diagnostics ──');

  // 5. Check Roles Modifier owner/avatar/target
  try {
    const [owner, avatar, target] = await Promise.all([
      publicClient.readContract({
        address: rolesModifierAddress,
        abi: ROLES_VIEW_ABI,
        functionName: 'owner',
      }),
      publicClient.readContract({
        address: rolesModifierAddress,
        abi: ROLES_VIEW_ABI,
        functionName: 'avatar',
      }),
      publicClient.readContract({
        address: rolesModifierAddress,
        abi: ROLES_VIEW_ABI,
        functionName: 'target',
      }),
    ]);
    console.log('Roles Modifier owner: ', owner, owner.toLowerCase() === safeAddress.toLowerCase() ? '✅ (Safe)' : '❌ (NOT Safe!)');
    console.log('Roles Modifier avatar:', avatar, avatar.toLowerCase() === safeAddress.toLowerCase() ? '✅ (Safe)' : '❌ (NOT Safe!)');
    console.log('Roles Modifier target:', target, target.toLowerCase() === safeAddress.toLowerCase() ? '✅ (Safe)' : '❌ (NOT Safe!)');
  } catch (err: any) {
    console.error('❌ Failed to read Roles Modifier state:', err.shortMessage || err.message);
  }

  // 6. Check if Roles Modifier is enabled as a module on the Safe
  try {
    const isEnabled = await publicClient.readContract({
      address: safeAddress,
      abi: SAFE_ABI,
      functionName: 'isModuleEnabled',
      args: [rolesModifierAddress],
    });
    console.log('Roles Modifier enabled on Safe:', isEnabled ? '✅ Yes' : '❌ NO — module not enabled!');
    if (!isEnabled) {
      console.error('   → The Roles Modifier must be enabled as a Safe module before swaps work.');
      console.error('   → Use the UI to enable it (ConfigureRoles → Enable Module step).');
    }
  } catch (err: any) {
    console.error('❌ Failed to check module status:', err.shortMessage || err.message);
  }

  // 7. Check Safe modules list
  try {
    const modules = await publicClient.readContract({
      address: safeAddress,
      abi: SAFE_ABI,
      functionName: 'getModules',
    });
    console.log('Safe modules:', modules.length > 0 ? modules.join(', ') : '(none)');
  } catch (err: any) {
    console.error('❌ Failed to get Safe modules:', err.shortMessage || err.message);
  }

  // 8. Check pool liquidity
  try {
    const liquidity = await publicClient.readContract({
      address: POOL_ADDRESS,
      abi: POOL_ABI,
      functionName: 'liquidity',
    });
    console.log('Pool liquidity:', liquidity.toString(), liquidity > BigInt(0) ? '✅' : '❌ No liquidity!');

    const slot0 = await publicClient.readContract({
      address: POOL_ADDRESS,
      abi: POOL_ABI,
      functionName: 'slot0',
    });
    console.log('Pool sqrtPriceX96:', slot0[0].toString());
    console.log('Pool tick:', slot0[1]);
    console.log('Pool unlocked:', slot0[6] ? '✅' : '❌ Locked!');
  } catch (err: any) {
    console.error('❌ Failed to read pool state:', err.shortMessage || err.message);
  }

  // 9. Check User B role membership
  try {
    const isMember = await publicClient.readContract({
      address: rolesModifierAddress,
      abi: ROLES_VIEW_ABI,
      functionName: 'members',
      args: [account.address, SWAP_ROLE_ID],
    });
    console.log('User B is member of role', SWAP_ROLE_ID, ':', isMember ? '✅ Yes' : '❌ NO — role not assigned!');
    if (!isMember) {
      console.error('   → Use the UI to assign User B to the swap role.');
    }
  } catch (err: any) {
    console.error('❌ Failed to check role membership:', err.shortMessage || err.message);
  }

  // 10. Try calling execTransactionWithRole with shouldRevert=false to get success/failure
  console.log();

  console.log();
  console.log('── Executing swap ──');

  // ── Build the swap calldata ──

  // Step 1: Encode the Uniswap exactInputSingle call
  const swapCalldata = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: USDC_SEPOLIA,
        tokenOut: WETH_SEPOLIA,
        fee: feeTier,
        recipient: safeAddress,         // tokens go back to the Safe
        amountIn,
        amountOutMinimum: BigInt(0),    // Accept any amount (test only!)
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  });

  // Step 2: Wrap in execTransactionWithRole
  const execData = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName: 'execTransactionWithRole',
    args: [
      UNISWAP_SWAP_ROUTER,   // to
      BigInt(0),               // value
      swapCalldata,            // data
      0,                       // operation: Call
      SWAP_ROLE_ID,            // role
      true,                    // shouldRevert
    ],
  });

  // ── Simulate first ──
  console.log('Simulating transaction...');
  try {
    await publicClient.call({
      account: account.address,
      to: rolesModifierAddress,
      data: execData,
    });
    console.log('✅ Simulation passed');
  } catch (err: any) {
    const msg = err.shortMessage || err.message || '';
    console.error('❌ Simulation reverted:', msg);

    // Try to decode Roles Modifier custom errors from the revert data
    const revertData = err.data || err.cause?.data;
    if (revertData && typeof revertData === 'string' && revertData.startsWith('0x') && revertData.length > 2) {
      console.error('   Raw revert data:', revertData);
      try {
        const decoded = decodeErrorResult({
          abi: ROLES_ERRORS_ABI,
          data: revertData as Hex,
        });
        console.error('   ⚡ Decoded error:', decoded.errorName, decoded.args);
      } catch {
        console.error('   (Could not decode as a known Roles Modifier error)');
        // Show first 10 bytes for selector identification
        console.error('   Error selector:', revertData.slice(0, 10));
      }
    }

    // Try to extract more details from the error chain
    if (err.walk) {
      const walkErr = err.walk((e: any) => e.data);
      if (walkErr?.data && typeof walkErr.data === 'string' && walkErr.data !== revertData) {
        console.error('   Nested revert data:', walkErr.data);
        try {
          const decoded = decodeErrorResult({
            abi: ROLES_ERRORS_ABI,
            data: walkErr.data as Hex,
          });
          console.error('   ⚡ Decoded nested error:', decoded.errorName, decoded.args);
        } catch {}
      }
    }

    // Also try simulating the swap directly (Safe → Router) to isolate the issue
    console.log();
    console.log('── Isolating: simulate swap directly from Safe (no Roles) ──');
    try {
      await publicClient.call({
        account: safeAddress, // pretend we're the Safe
        to: UNISWAP_SWAP_ROUTER,
        data: swapCalldata,
      });
      console.log('✅ Direct swap simulation passed — problem is in Roles Modifier config');
    } catch (directErr: any) {
      console.error('❌ Direct swap also fails:', directErr.shortMessage || directErr.message);
      if (directErr.data) console.error('   Revert data:', directErr.data);
    }

    console.error();
    console.error('   Possible causes:');
    console.error('   - User B is not assigned the swap role');
    console.error('   - The swap target/function is not scoped');
    console.error('   - The Roles Modifier is not enabled as a Safe module');
    console.error('   - The Safe USDC allowance to the Router is insufficient');
    console.error('   - The pool has no liquidity');
    process.exit(1);
  }

  // ── Send the transaction ──
  console.log('Sending transaction...');
  const txHash = await walletClient.sendTransaction({
    to: rolesModifierAddress,
    data: execData,
    value: BigInt(0),
  });
  console.log('Tx hash:', txHash);

  // ── Wait for receipt ──
  console.log('Waiting for confirmation...');
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 120_000,
  });

  if (receipt.status === 'success') {
    console.log('✅ Swap succeeded!');
    console.log('   Block:', receipt.blockNumber);
    console.log('   Gas used:', receipt.gasUsed.toString());
  } else {
    console.error('❌ Swap reverted on-chain.');
    process.exit(1);
  }

  // ── Post-swap balances ──
  const safeUsdcAfter = await publicClient.readContract({
    address: USDC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [safeAddress],
  });
  const safeWethAfter = await publicClient.readContract({
    address: WETH_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [safeAddress],
  });

  console.log();
  console.log('── Post-swap balances ──');
  console.log('Safe USDC:', formatUnits(safeUsdcAfter, 6), `(Δ ${formatUnits(safeUsdcAfter - safeUsdcBalance, 6)})`);
  console.log('Safe WETH:', formatEther(safeWethAfter), `(Δ ${formatEther(safeWethAfter - safeWethBefore)})`);
  console.log();
  console.log('Done ✓');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
