'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { deploySafe, predictSafeAddress } from '../lib/safe';
import { StatusMessage } from './StatusMessage';
import { formatError } from '../lib/errors';
import type { StatusState } from '../lib/types';

interface DeploySafeProps {
  onDeployed: (safeAddress: string) => void;
}

export function DeploySafe({ onDeployed }: DeploySafeProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [coOwner, setCoOwner] = useState('');
  const [threshold, setThreshold] = useState(1);
  const [existingSafe, setExistingSafe] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<StatusState>({
    status: 'idle',
    message: '',
  });

  // Auto-check if a Safe already exists for this owner config
  useEffect(() => {
    if (!walletClient || !address) return;

    let cancelled = false;

    const owners = [address];
    if (coOwner.trim()) {
      owners.push(coOwner.trim() as `0x${string}`);
    }

    predictSafeAddress(walletClient.transport, owners, threshold)
      .then(({ address: predicted, isDeployed }) => {
        if (cancelled) return;
        if (isDeployed) {
          setExistingSafe(predicted);
        } else {
          setExistingSafe(null);
        }
      })
      .catch((err) => {
        console.error('[DeploySafe] predict check:', err);
        if (!cancelled) setExistingSafe(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => { cancelled = true; };
  }, [walletClient, address, coOwner, threshold]);

  // If an existing Safe is detected, notify the parent
  const handleUseExisting = useCallback(() => {
    if (existingSafe) {
      onDeployed(existingSafe);
      setStatus({
        status: 'success',
        message: `Using existing Safe at ${existingSafe}`,
      });
    }
  }, [existingSafe, onDeployed]);

  const handleDeploy = useCallback(async () => {
    if (!walletClient || !address) {
      setStatus({ status: 'error', message: 'Connect your wallet first.' });
      return;
    }

    setStatus({ status: 'pending', message: 'Deploying Safe...' });

    try {
      const owners = [address];
      if (coOwner.trim()) {
        owners.push(coOwner.trim() as `0x${string}`);
      }

      const provider = walletClient.transport;
      const result = await deploySafe(provider, owners, threshold);

      setStatus({
        status: 'success',
        message: `Safe deployed at ${result.safeAddress}`,
      });
      onDeployed(result.safeAddress);
    } catch (err: unknown) {
      console.error('[DeploySafe]', err);
      setStatus({
        status: 'error',
        message: formatError(err, 'Deployment failed'),
      });
    }
  }, [walletClient, address, coOwner, threshold, onDeployed]);

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        1. Deploy Safe Smart Account
      </h2>

      {/* Existing Safe detected */}
      {existingSafe && (
        <div className="mb-4 rounded-lg border border-green-700 bg-green-900/20 p-4">
          <p className="text-sm text-green-300 font-medium mb-1">
            Existing Safe detected
          </p>
          <p className="font-mono text-xs text-green-400 truncate mb-3">
            {existingSafe}
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleUseExisting}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              Use This Safe
            </button>
            <a
              href={`https://sepolia.etherscan.io/address/${existingSafe}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              View on Etherscan
            </a>
          </div>
        </div>
      )}

      {checking && (
        <p className="text-xs text-zinc-500 mb-4 animate-pulse">
          Checking for existing Safe...
        </p>
      )}

      {/* Deploy form (shown when no existing Safe or user wants a new one) */}
      {!existingSafe && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Connected Owner
            </label>
            <p className="font-mono text-sm text-zinc-300 truncate">
              {address ?? 'Not connected'}
            </p>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Additional Owner (optional)
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              placeholder="0x..."
              value={coOwner}
              onChange={(e) => setCoOwner(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Threshold
            </label>
            <input
              type="number"
              min={1}
              max={coOwner ? 2 : 1}
              className="w-24 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </div>

          <button
            onClick={handleDeploy}
            disabled={!address || status.status === 'pending'}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status.status === 'pending' ? 'Deploying...' : 'Deploy Safe'}
          </button>
        </div>
      )}

      <StatusMessage {...status} />
    </div>
  );
}
