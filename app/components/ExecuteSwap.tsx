'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { parseEther } from 'viem';
import { executeSwapWithRole } from '../lib/roles';
import {
  WETH_SEPOLIA,
  USDC_SEPOLIA,
} from '../lib/constants';
import { StatusMessage } from './StatusMessage';
import { formatError } from '../lib/errors';
import type { StatusState, SwapParams } from '../lib/types';

interface ExecuteSwapProps {
  rolesModifierAddress: string;
  safeAddress: string;
}

export function ExecuteSwap({
  rolesModifierAddress,
  safeAddress,
}: ExecuteSwapProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [amountIn, setAmountIn] = useState('0.01');
  const [status, setStatus] = useState<StatusState>({
    status: 'idle',
    message: '',
  });

  const handleSwap = useCallback(async () => {
    if (!walletClient || !address) {
      setStatus({ status: 'error', message: 'Connect the agent wallet.' });
      return;
    }

    setStatus({
      status: 'pending',
      message: 'Executing swap through Roles Modifier...',
    });

    try {
      const provider = walletClient.transport;

      const swapParams: SwapParams = {
        tokenIn: WETH_SEPOLIA,
        tokenOut: USDC_SEPOLIA,
        fee: 3000, // 0.3% pool
        recipient: safeAddress, // tokens go back to the Safe
        amountIn: parseEther(amountIn),
        amountOutMinimum: BigInt(0), // Accept any amount (demo only – use slippage protection in prod)
        sqrtPriceLimitX96: BigInt(0),
      };

      const txHash = await executeSwapWithRole(
        provider,
        address,
        rolesModifierAddress,
        swapParams,
      );

      setStatus({
        status: 'success',
        message: 'Swap executed successfully!',
        txHash,
      });
    } catch (err: unknown) {
      console.error('[ExecuteSwap]', err);
      setStatus({
        status: 'error',
        message: formatError(err, 'Swap failed'),
      });
    }
  }, [walletClient, address, rolesModifierAddress, safeAddress, amountIn]);

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        3. Execute Swap (Agent)
      </h2>

      <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <p className="text-xs text-zinc-400 mb-2">How it works:</p>
        <ol className="list-decimal list-inside space-y-1 text-xs text-zinc-400">
          <li>
            The agent calls <code className="text-blue-300">execTransactionWithRole</code> on the Roles Modifier
          </li>
          <li>
            The modifier checks the agent has the <strong>Swap Role</strong> and the
            target function is <code className="text-blue-300">exactInputSingle</code>
          </li>
          <li>
            If allowed, the modifier forwards the call through the Safe
          </li>
          <li>
            The Safe executes the swap on Uniswap
          </li>
        </ol>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">
            Connected as (Agent)
          </label>
          <p className="font-mono text-sm text-zinc-300 truncate">
            {address ?? 'Not connected'}
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-zinc-400 mb-1">
              Token In
            </label>
            <div className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-zinc-300">
              WETH
            </div>
          </div>
          <div className="flex items-end pb-2 text-zinc-500">→</div>
          <div className="flex-1">
            <label className="block text-sm text-zinc-400 mb-1">
              Token Out
            </label>
            <div className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-zinc-300">
              USDC
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">
            Amount In (WETH)
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            placeholder="0.01"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
          />
        </div>

        <div className="rounded-lg bg-zinc-800/50 p-3 text-xs text-zinc-400 space-y-1">
          <p>
            <span className="text-zinc-500">Roles Modifier:</span>{' '}
            <span className="font-mono">{rolesModifierAddress}</span>
          </p>
          <p>
            <span className="text-zinc-500">Safe (receives tokens):</span>{' '}
            <span className="font-mono">{safeAddress}</span>
          </p>
          <p>
            <span className="text-zinc-500">Fee Tier:</span> 0.3%
          </p>
        </div>

        <button
          onClick={handleSwap}
          disabled={!address || status.status === 'pending'}
          className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {status.status === 'pending' ? 'Executing Swap...' : 'Execute Swap'}
        </button>
      </div>

      <StatusMessage {...status} />
    </div>
  );
}
