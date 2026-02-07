/**
 * Zodiac Roles Modifier – deployment, configuration, and execution helpers.
 *
 * Uses viem for ABI encoding and the wallet's EIP-1193 provider for sending
 * transactions. No ethers.js dependency required.
 */

import {
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toBytes,
  type Hex,
} from 'viem';

import {
  MODULE_PROXY_FACTORY_ADDRESS,
  MODULE_PROXY_FACTORY_ABI,
  ROLES_MODIFIER_MASTERCOPY,
  ROLES_MODIFIER_ABI,
  UNISWAP_SWAP_ROUTER,
  SWAP_ROUTER_ABI,
  EXACT_INPUT_SINGLE_SELECTOR,
  SWAP_ROLE_ID,
} from './constants';

import { getSafeInfo, executeViaSafe, executeBatchViaSafe } from './safe';
import type { RolesModifierDeployment, SwapParams, Eip1193Provider } from './types';

// ─────────────────────────────────────────────
// 1. Deploy Roles Modifier via Module Proxy Factory
// ─────────────────────────────────────────────

/**
 * Deploy a new Roles Modifier proxy via the Zodiac Module Proxy Factory.
 *
 * The initializer calls `setUp(abi.encode(owner, avatar, target))` where:
 *  - owner  = Safe address (controls configuration of roles)
 *  - avatar = Safe address (the account whose assets are managed)
 *  - target = Safe address (the contract calls are forwarded to)
 */
export async function deployRolesModifier(
  provider: unknown,
  sender: string,
  safeAddress: string,
): Promise<RolesModifierDeployment> {
  // Encode the setUp initializer
  const initParams = encodeAbiParameters(
    parseAbiParameters('address, address, address'),
    [safeAddress as Hex, safeAddress as Hex, safeAddress as Hex],
  );

  const initializer = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName: 'setUp',
    args: [initParams],
  });

  const saltNonce = BigInt(Date.now());

  // Encode the deployModule call
  const deployData = encodeFunctionData({
    abi: MODULE_PROXY_FACTORY_ABI,
    functionName: 'deployModule',
    args: [ROLES_MODIFIER_MASTERCOPY, initializer, saltNonce],
  });

  // Send the transaction
  const txHash = await (provider as Eip1193Provider).request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: sender,
        to: MODULE_PROXY_FACTORY_ADDRESS,
        data: deployData,
        value: '0x0',
      },
    ],
  }) as string;

  console.log('[Roles] Deploy tx:', txHash);

  // Wait for receipt and extract the proxy address from logs
  const receipt = await waitForReceipt(provider, txHash);
  const proxyAddress = extractProxyAddress(receipt);

  if (!proxyAddress) {
    throw new Error('Failed to extract Roles Modifier proxy address from logs');
  }

  console.log('[Roles] Modifier deployed at:', proxyAddress);

  return {
    rolesModifierAddress: proxyAddress,
    safeAddress,
  };
}

// ─────────────────────────────────────────────
// 2. Configure the Swap-Only Role
// ─────────────────────────────────────────────

/**
 * Configure the Roles Modifier:
 *  1. Assign the agent to a role (SWAP_ROLE_ID = 1)
 *  2. Scope the role to only the Uniswap SwapRouter
 *  3. Allow only the `exactInputSingle` function
 *
 * These calls must come from the Roles Modifier **owner** (the Safe).
 * Since the Safe owner signs, we execute these as individual transactions
 * through the wallet. In production these would be Safe transactions batched
 * via MultiSend.
 *
 * NOTE: These must be called by the owner of the Roles Modifier.
 * After deployment, the owner is the Safe itself, so we need to
 * execute these through the Safe using protocol-kit. For the MVP,
 * we send them from the deployer who will be temporarily set as owner.
 */
export async function configureSwapRole(
  provider: unknown,
  sender: string,
  safeAddress: string,
  rolesModifierAddress: string,
  userB: string,
): Promise<void> {
  // All 3 calls are owner-only on the Roles Modifier.
  // The owner is the Safe, so we batch them as a single Safe transaction.

  const assignData = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName: 'assignRoles',
    args: [userB as Hex, [SWAP_ROLE_ID], [true]],
  });

  const scopeTargetData = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName: 'scopeTarget',
    args: [SWAP_ROLE_ID, UNISWAP_SWAP_ROUTER],
  });

  const scopeFnData = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName: 'scopeAllowFunction',
    args: [SWAP_ROLE_ID, UNISWAP_SWAP_ROUTER, EXACT_INPUT_SINGLE_SELECTOR, 0],
  });

  const txHash = await executeBatchViaSafe(provider, sender, safeAddress, [
    { to: rolesModifierAddress, data: assignData, value: '0' },
    { to: rolesModifierAddress, data: scopeTargetData, value: '0' },
    { to: rolesModifierAddress, data: scopeFnData, value: '0' },
  ]);
  console.log('[Roles] configureSwapRole batch tx:', txHash);

  // Persist state
  saveRoleMember(rolesModifierAddress, userB);
  saveTargetScoped(rolesModifierAddress);
}

/**
 * Scope the SwapRouter as an allowed target for the swap role,
 * and allow the `exactInputSingle` function.
 *
 * Call this when the target isn't scoped yet (TargetAddressNotAllowed),
 * independently of member assignment.
 */
export async function scopeSwapTarget(
  provider: unknown,
  sender: string,
  safeAddress: string,
  rolesModifierAddress: string,
): Promise<void> {
  const scopeTargetData = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName: 'scopeTarget',
    args: [SWAP_ROLE_ID, UNISWAP_SWAP_ROUTER],
  });

  const scopeFnData = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName: 'scopeAllowFunction',
    args: [SWAP_ROLE_ID, UNISWAP_SWAP_ROUTER, EXACT_INPUT_SINGLE_SELECTOR, 0],
  });

  const txHash = await executeBatchViaSafe(provider, sender, safeAddress, [
    { to: rolesModifierAddress, data: scopeTargetData, value: '0' },
    { to: rolesModifierAddress, data: scopeFnData, value: '0' },
  ]);
  console.log('[Roles] scopeSwapTarget batch tx:', txHash);

  // Persist state
  saveTargetScoped(rolesModifierAddress);
}

/**
 * Assign the swap role to a new member (when scoping is already configured).
 */
export async function assignSwapRoleMember(
  provider: unknown,
  sender: string,
  safeAddress: string,
  rolesModifierAddress: string,
  member: string,
): Promise<void> {
  const assignData = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName: 'assignRoles',
    args: [member as Hex, [SWAP_ROLE_ID], [true]],
  });

  const txHash = await executeViaSafe(provider, sender, safeAddress, rolesModifierAddress, assignData);
  console.log('[Roles] assignRoleMember tx:', txHash);

  // Persist the assigned member
  saveRoleMember(rolesModifierAddress, member);
}

/**
 * Revoke the swap role from a member.
 * Calls `assignRoles` with `memberOf: [false]`.
 */
export async function revokeSwapRole(
  provider: unknown,
  sender: string,
  safeAddress: string,
  rolesModifierAddress: string,
  member: string,
): Promise<void> {
  const revokeData = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName: 'assignRoles',
    args: [member as Hex, [SWAP_ROLE_ID], [false]],
  });

  const txHash = await executeViaSafe(provider, sender, safeAddress, rolesModifierAddress, revokeData);
  console.log('[Roles] revokeRole tx:', txHash);

  // Remove from local storage
  removeRoleMember(rolesModifierAddress, member);
}

/**
 * Change the swap-role member: revoke from old, assign to new.
 */
export async function changeSwapRoleMember(
  provider: unknown,
  sender: string,
  safeAddress: string,
  rolesModifierAddress: string,
  oldMember: string,
  newMember: string,
): Promise<void> {
  const revokeData = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName: 'assignRoles',
    args: [oldMember as Hex, [SWAP_ROLE_ID], [false]],
  });

  const assignData = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName: 'assignRoles',
    args: [newMember as Hex, [SWAP_ROLE_ID], [true]],
  });

  const txHash = await executeBatchViaSafe(provider, sender, safeAddress, [
    { to: rolesModifierAddress, data: revokeData, value: '0' },
    { to: rolesModifierAddress, data: assignData, value: '0' },
  ]);
  console.log('[Roles] changeSwapRoleMember batch tx:', txHash);

  // Update local storage
  removeRoleMember(rolesModifierAddress, oldMember);
  saveRoleMember(rolesModifierAddress, newMember);
}

// ─────────────────────────────────────────────
// Role member & state persistence (localStorage)
// ─────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'uniclaw_role_members_';
const STORAGE_TARGET_SCOPED_PREFIX = 'uniclaw_target_scoped_';

export function saveTargetScoped(rolesModifierAddress: string): void {
  try {
    const key = STORAGE_TARGET_SCOPED_PREFIX + rolesModifierAddress.toLowerCase();
    localStorage.setItem(key, 'true');
  } catch {
    // SSR
  }
}

export function loadTargetScoped(rolesModifierAddress: string): boolean {
  try {
    const key = STORAGE_TARGET_SCOPED_PREFIX + rolesModifierAddress.toLowerCase();
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function saveRoleMember(rolesModifierAddress: string, member: string): void {
  try {
    const key = STORAGE_KEY_PREFIX + rolesModifierAddress.toLowerCase();
    const existing = loadRoleMembers(rolesModifierAddress);
    const normalized = member.toLowerCase();
    if (!existing.includes(normalized)) {
      existing.push(normalized);
    }
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {
    // localStorage may not be available (SSR)
  }
}

export function removeRoleMember(rolesModifierAddress: string, member: string): void {
  try {
    const key = STORAGE_KEY_PREFIX + rolesModifierAddress.toLowerCase();
    const existing = loadRoleMembers(rolesModifierAddress);
    const normalized = member.toLowerCase();
    const updated = existing.filter((m) => m !== normalized);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // localStorage may not be available (SSR)
  }
}

export function loadRoleMembers(rolesModifierAddress: string): string[] {
  try {
    const key = STORAGE_KEY_PREFIX + rolesModifierAddress.toLowerCase();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/**
 * Alternative: Build the role configuration as Safe transactions (for when
 * the Roles Modifier owner is the Safe itself).
 * Returns the encoded transaction data for each step.
 */
export function buildRoleConfigTxs(
  rolesModifierAddress: string,
  userB: string,
): { to: string; data: string; value: string }[] {
  const txs = [
    {
      to: rolesModifierAddress,
      data: encodeFunctionData({
        abi: ROLES_MODIFIER_ABI,
        functionName: 'assignRoles',
        args: [userB as Hex, [SWAP_ROLE_ID], [true]],
      }),
      value: '0',
    },
    {
      to: rolesModifierAddress,
      data: encodeFunctionData({
        abi: ROLES_MODIFIER_ABI,
        functionName: 'scopeTarget',
        args: [SWAP_ROLE_ID, UNISWAP_SWAP_ROUTER],
      }),
      value: '0',
    },
    {
      to: rolesModifierAddress,
      data: encodeFunctionData({
        abi: ROLES_MODIFIER_ABI,
        functionName: 'scopeAllowFunction',
        args: [
          SWAP_ROLE_ID,
          UNISWAP_SWAP_ROUTER,
          EXACT_INPUT_SINGLE_SELECTOR,
          0,
        ],
      }),
      value: '0',
    },
  ];

  return txs;
}

// ─────────────────────────────────────────────
// 3. Execute a Swap via the Roles Modifier (Agent)
// ─────────────────────────────────────────────

/**
 * The agent calls `execTransactionWithRole` on the Roles Modifier.
 * The modifier verifies the call is allowed by the role, then
 * forwards it to the Safe which executes the swap.
 */
export async function executeSwapWithRole(
  provider: unknown,
  userB: string,
  rolesModifierAddress: string,
  swapParams: SwapParams,
): Promise<string> {
  // Encode the Uniswap exactInputSingle call
  const swapCalldata = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: swapParams.tokenIn as Hex,
        tokenOut: swapParams.tokenOut as Hex,
        fee: swapParams.fee,
        recipient: swapParams.recipient as Hex,
        amountIn: swapParams.amountIn,
        amountOutMinimum: swapParams.amountOutMinimum,
        sqrtPriceLimitX96: swapParams.sqrtPriceLimitX96,
      },
    ],
  });

  // Encode the execTransactionWithRole call
  const execData = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName: 'execTransactionWithRole',
    args: [
      UNISWAP_SWAP_ROUTER,  // to
      BigInt(0),              // value
      swapCalldata,           // data
      0,                      // operation: Call
      SWAP_ROLE_ID,           // role
      true,                   // shouldRevert
    ],
  });

  const txHash = await (provider as Eip1193Provider).request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: userB,
        to: rolesModifierAddress,
        data: execData,
        value: '0x0',
      },
    ],
  }) as string;

  console.log('[Roles] execTransactionWithRole tx:', txHash);
  await waitForReceipt(provider, txHash as string);
  return txHash as string;
}

// ─────────────────────────────────────────────
// 4. Detect existing Roles Modifier state
// ─────────────────────────────────────────────

export interface RolesModifierState {
  /** Whether a Roles Modifier is found as an enabled module on the Safe */
  isDeployed: boolean;
  /** Whether it's enabled as a module on the Safe */
  isEnabled: boolean;
  /** Whether the SwapRouter is scoped as an allowed target for the role */
  isTargetScoped: boolean;
  /** Whether the swap role has been fully configured (target scoped + member assigned) */
  isConfigured: boolean;
  /** The address of the detected Roles Modifier (if any) */
  rolesModifierAddress: string | null;
  /** The current step the user should be at */
  currentStep: 'deploy' | 'enable' | 'configure' | 'done';
}

/**
 * Check the on-chain state to detect if the Roles Modifier has already been
 * deployed, enabled as a Safe module, and/or configured with roles.
 *
 * Detection strategy:
 *  1. Get Safe modules → find any that respond to `owner()` returning the Safe
 *  2. If found → it's deployed AND enabled
 *  3. Call the modifier to check if the swap role target is scoped
 */
export async function detectRolesModifierState(
  provider: unknown,
  signer: string,
  safeAddress: string,
): Promise<RolesModifierState> {
  const noState: RolesModifierState = {
    isDeployed: false,
    isEnabled: false,
    isTargetScoped: false,
    isConfigured: false,
    rolesModifierAddress: null,
    currentStep: 'deploy',
  };

  try {
    // Get modules enabled on the Safe
    const safeInfo = await getSafeInfo(provider, signer, safeAddress);
    const modules = safeInfo.modules;

    if (!modules || modules.length === 0) {
      return noState;
    }

    // Check each module to see if it's a Roles Modifier (has owner() that returns Safe)
    for (const moduleAddr of modules) {
      try {
        const ownerResult = await ethCall(provider, moduleAddr, 'owner');
        const avatarResult = await ethCall(provider, moduleAddr, 'avatar');

        // If owner() and avatar() both return the Safe address, it's our Roles Modifier
        const ownerAddr = parseAddressResult(ownerResult);
        const avatarAddr = parseAddressResult(avatarResult);

        if (
          ownerAddr?.toLowerCase() === safeAddress.toLowerCase() &&
          avatarAddr?.toLowerCase() === safeAddress.toLowerCase()
        ) {
          // Found a deployed & enabled Roles Modifier
          console.log('[Roles] Detected existing modifier:', moduleAddr);

          // Check configuration from persisted state (localStorage).
          // The execTransactionWithRole simulation approach doesn't work because
          // the Roles Modifier checks membership FIRST — address(0) is never
          // a member, so we always get NoMembership regardless of target/function config.
          const targetScoped = loadTargetScoped(moduleAddr);
          const members = loadRoleMembers(moduleAddr);
          const isConfigured = targetScoped && members.length > 0;

          console.log('[Roles] Config state — targetScoped:', targetScoped, 'members:', members.length);

          return {
            isDeployed: true,
            isEnabled: true,
            isTargetScoped: targetScoped,
            isConfigured,
            rolesModifierAddress: moduleAddr,
            currentStep: isConfigured ? 'done' : 'configure',
          };
        }
      } catch {
        // Not a Roles Modifier, skip
        continue;
      }
    }

    return noState;
  } catch (err) {
    console.error('[Roles] detectRolesModifierState error:', err);
    return noState;
  }
}

/**
 * Known custom error selectors from Roles Modifier v1.
 * These are keccak256 of the error signature, first 4 bytes.
 */
const _TARGET_NOT_ALLOWED_SELECTOR = '0xef3440ac'; // TargetAddressNotAllowed()
const _NO_MEMBERSHIP_SELECTOR = '0xfd8e9f28';      // NoMembership()
const _FUNCTION_NOT_ALLOWED_SELECTOR = '0x05e5a82e'; // FunctionNotAllowed()
const _MODULE_TX_FAILED_SELECTOR = '0xd27b44a9';     // ModuleTransactionFailed()

// Re-export for reference (used in documentation / debugging)
export {
  _TARGET_NOT_ALLOWED_SELECTOR as TARGET_NOT_ALLOWED_SELECTOR,
  _NO_MEMBERSHIP_SELECTOR as NO_MEMBERSHIP_SELECTOR,
  _FUNCTION_NOT_ALLOWED_SELECTOR as FUNCTION_NOT_ALLOWED_SELECTOR,
  _MODULE_TX_FAILED_SELECTOR as MODULE_TX_FAILED_SELECTOR,
};

/** Helper: make an eth_call for a simple view function */
async function ethCall(
  provider: unknown,
  to: string,
  functionName: 'owner' | 'avatar' | 'target',
): Promise<string> {
  const data = encodeFunctionData({
    abi: ROLES_MODIFIER_ABI,
    functionName,
    args: [],
  });

  return (provider as Eip1193Provider).request({
    method: 'eth_call',
    params: [{ to, data }, 'latest'],
  }) as Promise<string>;
}

/** Parse a 32-byte hex result into an address */
function parseAddressResult(result: string): string | null {
  if (!result || result === '0x' || result.length < 42) return null;
  // Result is 0x + 64 hex chars (32 bytes), address is last 20 bytes
  return '0x' + result.slice(result.length - 40);
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

interface TxReceipt {
  status?: string;
  logs?: Array<{ address?: string; topics?: string[] }>;
}

async function waitForReceipt(
  provider: unknown,
  txHash: string,
  maxWait = 120_000,
): Promise<TxReceipt> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const receipt = await (provider as Eip1193Provider).request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    }) as TxReceipt | null;
    if (receipt && receipt.status) {
      if (receipt.status === '0x0') throw new Error('Transaction reverted');
      return receipt;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Transaction confirmation timeout');
}

function extractProxyAddress(receipt: TxReceipt): string | null {
  // Compute the topic dynamically to avoid hardcoding errors
  const EVENT_TOPIC = keccak256(
    toBytes('ModuleProxyCreation(address,address)'),
  );

  console.log('[Roles] Looking for event topic:', EVENT_TOPIC);
  console.log('[Roles] Receipt logs count:', receipt.logs?.length ?? 0);

  for (const log of receipt.logs ?? []) {
    console.log('[Roles] Log:', {
      address: log.address,
      topics: log.topics,
    });

    if (
      log.topics?.[0]?.toLowerCase() === EVENT_TOPIC.toLowerCase() &&
      log.address?.toLowerCase() ===
        MODULE_PROXY_FACTORY_ADDRESS.toLowerCase()
    ) {
      // proxy address is topic[1], left-padded to 32 bytes
      const raw: string = log.topics[1];
      if (raw) {
        return '0x' + raw.slice(26); // remove 0x + 24 zero chars
      }
    }
  }

  // Fallback: look for any log from the factory with 3 topics (event + 2 indexed)
  for (const log of receipt.logs ?? []) {
    if (
      log.address?.toLowerCase() ===
        MODULE_PROXY_FACTORY_ADDRESS.toLowerCase() &&
      (log.topics?.length ?? 0) >= 2
    ) {
      console.log('[Roles] Fallback match on factory log');
      const raw: string | undefined = log.topics?.[1];
      if (raw) {
        return '0x' + raw.slice(26);
      }
    }
  }

  return null;
}
