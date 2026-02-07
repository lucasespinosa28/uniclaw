#!/usr/bin/env bun
import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const SWAP_ROUTER = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E' as const;
const USDC = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238' as const;
const WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as const;

const privateKey = process.env.USER_B_PRIVATE_KEY as Hex;
const rolesModifier = process.env.ROLES_MODIFIER_ADDRESS as Hex;
const safe = process.env.SAFE_ADDRESS as Hex;
const amount = parseUnits(process.env.SWAP_AMOUNT || '1', 6);

const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
const publicClient = createPublicClient({ chain: sepolia, transport: http() });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http() });

const swapData = encodeFunctionData({
  abi: [{
    name: 'exactInputSingle', type: 'function', stateMutability: 'payable',
    inputs: [{ name: 'params', type: 'tuple', components: [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' },
      { name: 'fee', type: 'uint24' }, { name: 'recipient', type: 'address' },
      { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ]}],
    outputs: [{ name: '', type: 'uint256' }],
  }] as const,
  functionName: 'exactInputSingle',
  args: [{ tokenIn: USDC, tokenOut: WETH, fee: 10000, recipient: safe, amountIn: amount, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }],
});

const execData = encodeFunctionData({
  abi: [{
    name: 'execTransactionWithRole', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' }, { name: 'operation', type: 'uint8' },
      { name: 'role', type: 'uint16' }, { name: 'shouldRevert', type: 'bool' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  }] as const,
  functionName: 'execTransactionWithRole',
  args: [SWAP_ROUTER, 0n, swapData, 0, 1, true],
});

try {
  const hash = await walletClient.sendTransaction({ to: rolesModifier, data: execData, value: 0n });
  console.log('Transaction sent, hash:', hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  console.log(receipt.status === 'success' ? '✅ Swap succeeded' : '❌ Swap failed');
} catch (e: any) {
  console.log('❌ Swap failed:', e.shortMessage || e.message);
}
