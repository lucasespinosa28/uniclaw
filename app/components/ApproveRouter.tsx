'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { encodeFunctionData, formatUnits, parseUnits, maxUint256, type Hex } from 'viem';
import { executeViaSafe } from '../lib/safe';
import {
  UNISWAP_SWAP_ROUTER,
  USDC_SEPOLIA,
  WETH_SEPOLIA,
  UNI_SEPOLIA,
} from '../lib/constants';
import { StatusMessage } from './StatusMessage';
import { formatError } from '../lib/errors';
import type { StatusState } from '../lib/types';

interface ApproveRouterProps {
  safeAddress: string;
}

const ERC20_ABI = [
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
] as const;

interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
}

interface TokenAllowance extends TokenInfo {
  allowance: bigint;
  approved: boolean;
}

const TOKENS: TokenInfo[] = [
  { symbol: 'USDC', address: USDC_SEPOLIA, decimals: 6 },
  { symbol: 'WETH', address: WETH_SEPOLIA, decimals: 18 },
  { symbol: 'UNI', address: UNI_SEPOLIA, decimals: 18 },
];

export function ApproveRouter({ safeAddress }: ApproveRouterProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [allowances, setAllowances] = useState<TokenAllowance[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusState>({ status: 'idle', message: '' });

  // Per-token approval form state
  const [selectedToken, setSelectedToken] = useState<string>(TOKENS[0].address);
  const [approveAmount, setApproveAmount] = useState('');
  const [useUnlimited, setUseUnlimited] = useState(false);

  const fetchAllowances = useCallback(async () => {
    if (!walletClient || !safeAddress) return;
    setLoading(true);

    try {
      const provider = walletClient.transport;

      const rpcCall = (method: string, params: unknown[]) =>
        (provider as { request: (a: { method: string; params: unknown[] }) => Promise<string> })
          .request({ method, params });

      const results = await Promise.all(
        TOKENS.map(async (token) => {
          const data = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [safeAddress as Hex, UNISWAP_SWAP_ROUTER],
          });

          const result = await rpcCall('eth_call', [
            { to: token.address, data },
            'latest',
          ]);

          const allowance = BigInt(result || '0x0');
          const approved = allowance > BigInt('1000000000000000000000000000000');

          return { ...token, allowance, approved };
        }),
      );

      setAllowances(results);
    } catch (err) {
      console.error('[ApproveRouter] fetch allowances error', err);
    } finally {
      setLoading(false);
    }
  }, [walletClient, safeAddress]);

  useEffect(() => {
    fetchAllowances();
  }, [fetchAllowances]);

  const getSelectedTokenInfo = useCallback(() => {
    return TOKENS.find((t) => t.address === selectedToken) ?? TOKENS[0];
  }, [selectedToken]);

  const handleApprove = useCallback(async () => {
    if (!walletClient || !address) return;

    const token = getSelectedTokenInfo();
    let amount: bigint;

    if (useUnlimited) {
      amount = maxUint256;
    } else {
      const trimmed = approveAmount.trim();
      if (!trimmed || parseFloat(trimmed) <= 0) {
        setStatus({ status: 'error', message: 'Enter a valid amount.' });
        return;
      }
      amount = parseUnits(trimmed, token.decimals);
    }

    const label = useUnlimited ? 'unlimited' : `${approveAmount} ${token.symbol}`;
    setStatus({ status: 'pending', message: `Approving ${label} for SwapRouter...` });

    try {
      const provider = walletClient.transport;
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [UNISWAP_SWAP_ROUTER, amount],
      });

      await executeViaSafe(provider, address, safeAddress, token.address, data);

      setStatus({
        status: 'success',
        message: `${token.symbol} approved (${label}) for SwapRouter.`,
      });

      setApproveAmount('');
      await fetchAllowances();
    } catch (err: unknown) {
      console.error('[ApproveRouter] approve error', err);
      setStatus({ status: 'error', message: formatError(err, `${token.symbol} approval failed`) });
    }
  }, [walletClient, address, safeAddress, approveAmount, useUnlimited, getSelectedTokenInfo, fetchAllowances]);

  const isPending = status.status === 'pending';

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Token Approvals</h2>
      <p className="text-xs text-zinc-500 mb-4">
        The Safe must approve the Uniswap SwapRouter to spend tokens before swaps can execute.
      </p>

      {/* Current allowances */}
      {loading && allowances.length === 0 && (
        <p className="text-sm text-zinc-400 animate-pulse">Loading allowances...</p>
      )}

      {allowances.length > 0 && (
        <div className="space-y-2 mb-5">
          {allowances.map((token) => (
            <div
              key={token.address}
              className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 p-3"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                  token.approved
                    ? 'bg-green-900/50 text-green-400 border border-green-700'
                    : token.allowance > BigInt(0)
                    ? 'bg-blue-900/50 text-blue-400 border border-blue-700'
                    : 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                }`}
              >
                {token.approved ? '✓' : token.allowance > BigInt(0) ? '~' : '!'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{token.symbol}</p>
                <p className="text-xs text-zinc-500">
                  {token.approved
                    ? 'Approved (unlimited)'
                    : token.allowance > BigInt(0)
                    ? `Allowance: ${formatUnits(token.allowance, token.decimals)}`
                    : 'Not approved'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve form */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Set Allowance</h3>

        {/* Token selector */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Token</label>
          <select
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value)}
            className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {TOKENS.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>

        {/* Amount input */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Amount</label>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              className="flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none disabled:opacity-40"
              placeholder={`e.g. 100`}
              value={approveAmount}
              onChange={(e) => setApproveAmount(e.target.value)}
              disabled={useUnlimited}
            />
            <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={useUnlimited}
                onChange={(e) => setUseUnlimited(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-900 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-zinc-400">Unlimited</span>
            </label>
          </div>
        </div>

        {/* Approve button */}
        <button
          onClick={handleApprove}
          disabled={isPending || (!useUnlimited && !approveAmount.trim())}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending
            ? 'Approving...'
            : `Approve ${getSelectedTokenInfo().symbol}`}
        </button>
      </div>

      <div className="flex items-center justify-end mt-3">
        <button
          onClick={fetchAllowances}
          disabled={loading}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:text-zinc-500 transition-colors"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <StatusMessage {...status} />
    </div>
  );
}
