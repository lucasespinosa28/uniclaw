'use client';

import { useState, useCallback } from 'react';
import { useWalletClient } from 'wagmi';
import {
  WETH_SEPOLIA,
  USDC_SEPOLIA,
  UNI_SEPOLIA,
} from '../lib/constants';
import {
  findPools,
  saveAllowedPool,
  type PoolInfo,
  type AllowedPool,
} from '../lib/pools';
import { formatError } from '../lib/errors';

/** Well-known tokens for quick pick */
const KNOWN_TOKENS: { label: string; address: string }[] = [
  { label: 'WETH', address: WETH_SEPOLIA },
  { label: 'USDC', address: USDC_SEPOLIA },
  { label: 'UNI', address: UNI_SEPOLIA },
];

/** Resolve a token address to its symbol (if known) */
function resolveSymbol(address: string): string {
  const lower = address.toLowerCase();
  for (const t of KNOWN_TOKENS) {
    if (t.address.toLowerCase() === lower) return t.label;
  }
  return address.slice(0, 10) + '…';
}

interface PoolFinderProps {
  /** If provided, shows "Add" buttons and saves to allowed-pool list */
  rolesModifierAddress?: string;
  /** Called after a pool is added to the allowed list */
  onPoolAdded?: (pool: AllowedPool) => void;
}

export function PoolFinder({ rolesModifierAddress, onPoolAdded }: PoolFinderProps) {
  const { data: walletClient } = useWalletClient();

  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState('');
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!walletClient) {
      setError('Connect your wallet first.');
      return;
    }

    const a = tokenA.trim();
    const b = tokenB.trim();
    if (!a || !b) {
      setError('Enter both token addresses.');
      return;
    }
    if (a.toLowerCase() === b.toLowerCase()) {
      setError('Token addresses must be different.');
      return;
    }

    setLoading(true);
    setError('');
    setPools([]);
    setSearched(false);

    try {
      const results = await findPools(walletClient.transport, a, b);
      setPools(results);
      setSearched(true);
    } catch (err) {
      setError(formatError(err, 'Pool search failed'));
    } finally {
      setLoading(false);
    }
  }, [walletClient, tokenA, tokenB]);

  const handleAddPool = useCallback(
    (pool: PoolInfo) => {
      if (!rolesModifierAddress) return;

      const allowed: AllowedPool = {
        tokenA: tokenA.trim(),
        tokenB: tokenB.trim(),
        fee: pool.fee,
        poolAddress: pool.poolAddress,
        feeLabel: pool.feeLabel,
      };

      saveAllowedPool(rolesModifierAddress, allowed);
      onPoolAdded?.(allowed);
    },
    [rolesModifierAddress, tokenA, tokenB, onPoolAdded],
  );

  /** Quick-fill a token address */
  const fillToken = (setter: (v: string) => void, address: string) => {
    setter(address);
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Pool Finder</h2>
      <p className="text-xs text-zinc-500 mb-4">
        Enter two token addresses to find Uniswap pools. Both orderings are checked automatically.
      </p>

      <div className="space-y-3">
        {/* Token A */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Token A</label>
          <input
            type="text"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none font-mono"
            placeholder="0x..."
            value={tokenA}
            onChange={(e) => setTokenA(e.target.value)}
          />
          <div className="flex gap-1.5 mt-1.5">
            {KNOWN_TOKENS.map((t) => (
              <button
                key={t.address}
                onClick={() => fillToken(setTokenA, t.address)}
                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Token B */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Token B</label>
          <input
            type="text"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none font-mono"
            placeholder="0x..."
            value={tokenB}
            onChange={(e) => setTokenB(e.target.value)}
          />
          <div className="flex gap-1.5 mt-1.5">
            {KNOWN_TOKENS.map((t) => (
              <button
                key={t.address}
                onClick={() => fillToken(setTokenB, t.address)}
                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={loading || !tokenA.trim() || !tokenB.trim()}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Find Pools'}
        </button>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Results */}
        {searched && pools.length === 0 && !loading && (
          <p className="text-sm text-zinc-400">No pools found for this pair.</p>
        )}

        {pools.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300">
              {pools.length} pool{pools.length > 1 ? 's' : ''} found
              <span className="text-xs text-zinc-500 ml-1">(sorted by liquidity)</span>
            </h3>

            {pools.map((pool) => {
              const symbolA = resolveSymbol(tokenA.trim());
              const symbolB = resolveSymbol(tokenB.trim());
              const skillCmd = `Add the ${symbolA}/${symbolB} pool at ${pool.poolAddress} with fee ${pool.fee}`;

              return (
                <div
                  key={pool.poolAddress}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-block rounded bg-purple-900/50 border border-purple-700 px-2 py-0.5 text-xs font-semibold text-purple-300">
                          {symbolA}/{symbolB}
                        </span>
                        <span className="inline-block rounded bg-blue-900/50 border border-blue-700 px-2 py-0.5 text-xs font-medium text-blue-300">
                          Fee: {pool.fee}
                        </span>
                        <span className="text-xs text-zinc-500">
                          Liquidity: {pool.liquidityNum > 0 ? pool.liquidity : '0 (empty)'}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-zinc-400 truncate" title={pool.poolAddress}>
                        Pool: {pool.poolAddress}
                      </p>
                      <div className="mt-1 space-y-0.5">
                        <p className="font-mono text-xs text-zinc-500 truncate" title={tokenA.trim()}>
                          {symbolA}: <span className="text-zinc-400">{tokenA.trim()}</span>
                        </p>
                        <p className="font-mono text-xs text-zinc-500 truncate" title={tokenB.trim()}>
                          {symbolB}: <span className="text-zinc-400">{tokenB.trim()}</span>
                        </p>
                      </div>
                    </div>

                    {rolesModifierAddress && (
                      <button
                        onClick={() => handleAddPool(pool)}
                        className="shrink-0 rounded bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 transition-colors"
                      >
                        Add
                      </button>
                    )}
                  </div>

                  {/* Skill command */}
                  <div className="mt-2 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 overflow-x-auto">
                    <code className="text-[11px] text-zinc-500 whitespace-nowrap select-all">
                      {skillCmd}
                    </code>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
