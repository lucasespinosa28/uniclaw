/**
 * uniswap pool discovery and allowed-pool management.
 *
 * Given two token addresses, queries the uniswap Factory for all fee tiers
 * and returns pools sorted by liquidity.
 */

import { encodeFunctionData, type Hex } from 'viem';
import {
  UNISWAP_V3_FACTORY,
  UNISWAP_V3_FACTORY_ABI,
  UNISWAP_V3_POOL_ABI,
  FEE_TIERS,
  FEE_TIER_LABELS,
} from './constants';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface PoolInfo {
  /** Pool contract address */
  poolAddress: string;
  /** Lower-address token */
  token0: string;
  /** Higher-address token */
  token1: string;
  /** Fee tier (100, 500, 3000, 10000) */
  fee: number;
  /** Human label e.g. "0.3%" */
  feeLabel: string;
  /** Raw liquidity (uint128 as bigint string) */
  liquidity: string;
  /** Liquidity as a number (for sorting; inexact for display) */
  liquidityNum: number;
}

export interface AllowedPool {
  tokenA: string;
  tokenB: string;
  fee: number;
  poolAddress: string;
  feeLabel: string;
}

// ──────────────────────────────────────────────
// RPC helpers
// ──────────────────────────────────────────────

function rpcCall(provider: unknown, method: string, params: unknown[]): Promise<string> {
  return (provider as { request: (a: { method: string; params: unknown[] }) => Promise<string> })
    .request({ method, params });
}

function parseAddress(hex: string): string {
  // eth_call returns a 32-byte padded result
  if (hex.length >= 66) {
    return '0x' + hex.slice(26).toLowerCase();
  }
  return hex.toLowerCase();
}

function parseBigInt(hex: string): bigint {
  if (!hex || hex === '0x' || hex === '0x0') return BigInt(0);
  return BigInt(hex);
}

// ──────────────────────────────────────────────
// Pool discovery
// ──────────────────────────────────────────────

/**
 * Find all uniswap pools for a pair of tokens across all standard fee tiers.
 * Automatically queries both orderings (tokenA/tokenB and tokenB/tokenA) –
 * uniswap Factory normalises ordering internally, so both return the same pool.
 * Results are sorted by liquidity descending.
 */
export async function findPools(
  provider: unknown,
  tokenA: string,
  tokenB: string,
): Promise<PoolInfo[]> {
  // Query getPool for each fee tier
  // The Factory sorts token order internally, so we only need one ordering
  const getPoolCalls = FEE_TIERS.map((fee) => {
    const data = encodeFunctionData({
      abi: UNISWAP_V3_FACTORY_ABI,
      functionName: 'getPool',
      args: [tokenA as Hex, tokenB as Hex, fee],
    });
    return rpcCall(provider, 'eth_call', [
      { to: UNISWAP_V3_FACTORY, data },
      'latest',
    ]).then((result) => ({ fee, poolAddress: parseAddress(result) }));
  });

  const results = await Promise.all(getPoolCalls);

  // Filter out zero-address pools (pool doesn't exist)
  const existingPools = results.filter(
    (r) => r.poolAddress !== '0x0000000000000000000000000000000000000000'
  );

  if (existingPools.length === 0) return [];

  // For each existing pool, fetch token0, token1, and liquidity
  const detailCalls = existingPools.map(async ({ fee, poolAddress }) => {
    const liquidityData = encodeFunctionData({
      abi: UNISWAP_V3_POOL_ABI,
      functionName: 'liquidity',
    });
    const token0Data = encodeFunctionData({
      abi: UNISWAP_V3_POOL_ABI,
      functionName: 'token0',
    });
    const token1Data = encodeFunctionData({
      abi: UNISWAP_V3_POOL_ABI,
      functionName: 'token1',
    });

    const [liqHex, t0Hex, t1Hex] = await Promise.all([
      rpcCall(provider, 'eth_call', [{ to: poolAddress, data: liquidityData }, 'latest']),
      rpcCall(provider, 'eth_call', [{ to: poolAddress, data: token0Data }, 'latest']),
      rpcCall(provider, 'eth_call', [{ to: poolAddress, data: token1Data }, 'latest']),
    ]);

    const liquidity = parseBigInt(liqHex);

    return {
      poolAddress,
      token0: parseAddress(t0Hex),
      token1: parseAddress(t1Hex),
      fee,
      feeLabel: FEE_TIER_LABELS[fee] ?? `${fee}`,
      liquidity: liquidity.toString(),
      liquidityNum: Number(liquidity),
    } satisfies PoolInfo;
  });

  const poolDetails = await Promise.all(detailCalls);

  // Sort by liquidity descending
  poolDetails.sort((a, b) => b.liquidityNum - a.liquidityNum);

  return poolDetails;
}

// ──────────────────────────────────────────────
// Allowed-pool persistence (localStorage)
// ──────────────────────────────────────────────

const POOL_STORAGE_PREFIX = 'uniclaw_allowed_pools_';

export function saveAllowedPool(rolesModifierAddress: string, pool: AllowedPool): void {
  try {
    const key = POOL_STORAGE_PREFIX + rolesModifierAddress.toLowerCase();
    const existing = loadAllowedPools(rolesModifierAddress);
    const dup = existing.find(
      (p) =>
        p.poolAddress.toLowerCase() === pool.poolAddress.toLowerCase(),
    );
    if (!dup) {
      existing.push({
        ...pool,
        tokenA: pool.tokenA.toLowerCase(),
        tokenB: pool.tokenB.toLowerCase(),
        poolAddress: pool.poolAddress.toLowerCase(),
      });
    }
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {
    // SSR guard
  }
}

export function removeAllowedPool(rolesModifierAddress: string, poolAddress: string): void {
  try {
    const key = POOL_STORAGE_PREFIX + rolesModifierAddress.toLowerCase();
    const existing = loadAllowedPools(rolesModifierAddress);
    const updated = existing.filter(
      (p) => p.poolAddress.toLowerCase() !== poolAddress.toLowerCase(),
    );
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // SSR guard
  }
}

export function loadAllowedPools(rolesModifierAddress: string): AllowedPool[] {
  try {
    const key = POOL_STORAGE_PREFIX + rolesModifierAddress.toLowerCase();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as AllowedPool[];
  } catch {
    return [];
  }
}
