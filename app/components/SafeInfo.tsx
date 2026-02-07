'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { formatEther, formatUnits, type Hex } from 'viem';
import { getSafeInfo } from '../lib/safe';
import { WETH_SEPOLIA, USDC_SEPOLIA, UNI_SEPOLIA } from '../lib/constants';

interface SafeInfoProps {
  safeAddress: string;
}

interface SafeData {
  address: string;
  owners: string[];
  threshold: number;
  modules: string[];
}

interface TokenBalances {
  eth: string;
  weth: string;
  usdc: string;
  uni: string;
}

export function SafeInfo({ safeAddress }: SafeInfoProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [info, setInfo] = useState<SafeData | null>(null);
  const [balances, setBalances] = useState<TokenBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [balancesLoading, setBalancesLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!walletClient || !safeAddress) return;
    setBalancesLoading(true);

    try {
      const provider = walletClient.transport;

      // Helper to make a JSON-RPC call
      const rpcCall = (method: string, params: unknown[]) =>
        new Promise<string>((resolve, reject) => {
          (provider as { request: (args: { method: string; params: unknown[] }) => Promise<string> })
            .request({ method, params })
            .then(resolve)
            .catch(reject);
        });

      // balanceOf(address) selector = 0x70a08231
      const encodedAddr = safeAddress.slice(2).toLowerCase().padStart(64, '0');
      const balanceOfData = `0x70a08231${encodedAddr}` as Hex;

      // Fetch all 4 balances in parallel
      const [ethBal, wethBal, usdcBal, uniBal] = await Promise.all([
        rpcCall('eth_getBalance', [safeAddress, 'latest']),
        rpcCall('eth_call', [{ to: WETH_SEPOLIA, data: balanceOfData }, 'latest']),
        rpcCall('eth_call', [{ to: USDC_SEPOLIA, data: balanceOfData }, 'latest']),
        rpcCall('eth_call', [{ to: UNI_SEPOLIA, data: balanceOfData }, 'latest']),
      ]);

      setBalances({
        eth: formatEther(BigInt(ethBal)),
        weth: formatEther(BigInt(wethBal)),          // WETH has 18 decimals
        usdc: formatUnits(BigInt(usdcBal), 6),       // USDC has 6 decimals
        uni: formatEther(BigInt(uniBal)),             // UNI has 18 decimals
      });
    } catch (err) {
      console.error('[SafeInfo] balance fetch error', err);
    } finally {
      setBalancesLoading(false);
    }
  }, [walletClient, safeAddress]);

  useEffect(() => {
    if (!walletClient || !address || !safeAddress) return;

    let cancelled = false;
    setLoading(true);

    getSafeInfo(walletClient.transport, address, safeAddress)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err) => {
        console.error('[SafeInfo]', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [walletClient, address, safeAddress]);

  // Fetch balances on mount and when safeAddress changes
  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-white mb-3">Safe Details</h2>

      {loading && (
        <p className="text-sm text-zinc-400 animate-pulse">Loading...</p>
      )}

      {info && (
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-zinc-500">Address:</span>
            <a
              href={`https://sepolia.etherscan.io/address/${info.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 font-mono text-blue-400 hover:underline truncate"
            >
              {info.address}
            </a>
          </div>

          <div>
            <span className="text-zinc-500">Threshold:</span>
            <span className="ml-2 text-white">
              {info.threshold} of {info.owners.length}
            </span>
          </div>

          <div>
            <span className="text-zinc-500">Owners:</span>
            <ul className="mt-1 space-y-1 pl-4">
              {info.owners.map((o) => (
                <li key={o} className="font-mono text-xs text-zinc-300 truncate">
                  {o}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="text-zinc-500">Modules:</span>
            {info.modules.length === 0 ? (
              <span className="ml-2 text-zinc-400">None</span>
            ) : (
              <ul className="mt-1 space-y-1 pl-4">
                {info.modules.map((m) => (
                  <li
                    key={m}
                    className="font-mono text-xs text-green-400 truncate"
                  >
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Skill config command */}
          {info.modules.length > 0 && (
            <div className="mt-4 rounded-lg bg-zinc-800 border border-zinc-700 p-3">
              <p className="text-xs text-zinc-500 mb-2">Say this to the AI agent:</p>
              <p className="text-xs font-mono text-green-400 break-all select-all whitespace-pre-wrap">
                {`Set the safe address to ${info.address} and roles modifier to ${info.modules[0]}`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Token Balances */}
      <div className="mt-5 pt-4 border-t border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Balances</h3>
          <button
            onClick={fetchBalances}
            disabled={balancesLoading}
            className="text-xs text-blue-400 hover:text-blue-300 disabled:text-zinc-500 transition-colors"
          >
            {balancesLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {balancesLoading && !balances && (
          <p className="text-sm text-zinc-400 animate-pulse">Loading balances...</p>
        )}

        {balances && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-3">
              <p className="text-xs text-zinc-500 mb-1">ETH</p>
              <p className="text-sm font-mono text-white truncate" title={balances.eth}>
                {parseFloat(balances.eth).toFixed(6)}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-3">
              <p className="text-xs text-zinc-500 mb-1">WETH</p>
              <p className="text-sm font-mono text-white truncate" title={balances.weth}>
                {parseFloat(balances.weth).toFixed(6)}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-3">
              <p className="text-xs text-zinc-500 mb-1">USDC</p>
              <p className="text-sm font-mono text-white truncate" title={balances.usdc}>
                {parseFloat(balances.usdc).toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-3">
              <p className="text-xs text-zinc-500 mb-1">UNI</p>
              <p className="text-sm font-mono text-white truncate" title={balances.uni}>
                {parseFloat(balances.uni).toFixed(6)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
