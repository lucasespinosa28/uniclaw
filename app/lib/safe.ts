/**
 * Safe Protocol Kit service layer.
 *
 * Uses `Safe.init()` (Protocol Kit v6+) – the EthersAdapter / SafeFactory
 * pattern was removed in v4.
 */

import Safe from '@safe-global/protocol-kit';
import type { SafeAccountConfig } from '@safe-global/protocol-kit';
import type { SafeDeploymentResult, Eip1193Provider } from './types';

/**
 * Deploy a new Safe smart account.
 *
 * Flow:
 *  1. `Safe.init()` with `predictedSafe` config (off-chain prediction)
 *  2. `createSafeDeploymentTransaction()` returns a raw tx
 *  3. Wallet sends the tx → Safe is deployed on-chain
 *  4. Re-initialise SDK with the real `safeAddress`
 *
 * @param provider  EIP-1193 provider (e.g. `window.ethereum`)
 * @param owners    Owner addresses (at least the connected wallet)
 * @param threshold Confirmation threshold (defaults to 1)
 */
/**
 * Predict the Safe address for a given owner set + threshold WITHOUT deploying.
 * Also returns whether the Safe is already deployed on-chain.
 */
export async function predictSafeAddress(
  provider: unknown,
  owners: string[],
  threshold = 1,
): Promise<{ address: string; isDeployed: boolean }> {
  const safeAccountConfig: SafeAccountConfig = { owners, threshold };

  const safeSdk = await Safe.init({
    provider: provider as Eip1193Provider,
    signer: owners[0],
    predictedSafe: { safeAccountConfig },
  });

  const address = await safeSdk.getAddress();
  const isDeployed = await safeSdk.isSafeDeployed();

  return { address, isDeployed };
}

export async function deploySafe(
  provider: unknown,
  owners: string[],
  threshold = 1,
): Promise<SafeDeploymentResult> {
  const safeAccountConfig: SafeAccountConfig = { owners, threshold };

  // 1. Predict the Safe address
  const safeSdk = await Safe.init({
    provider: provider as Eip1193Provider,
    signer: owners[0],
    predictedSafe: { safeAccountConfig },
  });

  const predictedAddress = await safeSdk.getAddress();
  console.log('[Safe] Predicted address:', predictedAddress);

  // 1b. Check if already deployed
  const alreadyDeployed = await safeSdk.isSafeDeployed();
  if (alreadyDeployed) {
    console.log('[Safe] Already deployed at:', predictedAddress);
    return {
      safeAddress: predictedAddress,
      owners,
      threshold,
    };
  }

  // 2. Build the deployment transaction
  const deployTx = await safeSdk.createSafeDeploymentTransaction();

  // 3. Send via the connected wallet (EIP-1193)
  const txHash = await (provider as Eip1193Provider).request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: owners[0],
        to: deployTx.to,
        value: deployTx.value ? `0x${BigInt(deployTx.value).toString(16)}` : '0x0',
        data: deployTx.data,
      },
    ],
  }) as string;

  console.log('[Safe] Deployment tx:', txHash);

  // 4. Wait for confirmation
  await waitForTx(provider, txHash);

  return {
    safeAddress: predictedAddress,
    owners,
    threshold,
  };
}

/**
 * Enable a module (e.g. the Roles Modifier) on an existing Safe.
 *
 * This creates a Safe transaction that calls `enableModule` on the Safe
 * itself, signs it, and executes it.
 */
export async function enableModuleOnSafe(
  provider: unknown,
  signer: string,
  safeAddress: string,
  moduleAddress: string,
): Promise<string> {
  const safeSdk = await Safe.init({
    provider: provider as Eip1193Provider,
    signer,
    safeAddress,
  });

  // Create the enableModule Safe transaction
  const enableModuleTx = await safeSdk.createEnableModuleTx(moduleAddress);

  // Sign it
  const signedTx = await safeSdk.signTransaction(enableModuleTx);

  // Execute it
  const result = await safeSdk.executeTransaction(signedTx);
  const txHash = result.hash;
  console.log('[Safe] enableModule tx:', txHash);

  return txHash;
}

/**
 * Get basic info about a Safe (owners, threshold, modules).
 */
export async function getSafeInfo(provider: unknown, signer: string, safeAddress: string) {
  const safeSdk = await Safe.init({
    provider: provider as Eip1193Provider,
    signer,
    safeAddress,
  });

  const owners = await safeSdk.getOwners();
  const threshold = await safeSdk.getThreshold();
  const modules = await safeSdk.getModules();

  return { owners, threshold, modules, address: safeAddress };
}

/**
 * Execute an arbitrary call through the Safe.
 *
 * Creates a Safe transaction, signs it, and executes it.
 * This is required for any call to a contract whose `owner()` is the Safe
 * (e.g. the Roles Modifier).
 */
export async function executeViaSafe(
  provider: unknown,
  signer: string,
  safeAddress: string,
  to: string,
  data: string,
  value = '0',
): Promise<string> {
  const safeSdk = await Safe.init({
    provider: provider as Eip1193Provider,
    signer,
    safeAddress,
  });

  const safeTx = await safeSdk.createTransaction({
    transactions: [{ to, data, value }],
  });

  const signedTx = await safeSdk.signTransaction(safeTx);
  const result = await safeSdk.executeTransaction(signedTx);
  console.log('[Safe] executeViaSafe tx:', result.hash);
  return result.hash;
}

/**
 * Execute multiple calls through the Safe in a single batched transaction
 * (uses MultiSend under the hood).
 */
export async function executeBatchViaSafe(
  provider: unknown,
  signer: string,
  safeAddress: string,
  transactions: { to: string; data: string; value?: string }[],
): Promise<string> {
  const safeSdk = await Safe.init({
    provider: provider as Eip1193Provider,
    signer,
    safeAddress,
  });

  const safeTx = await safeSdk.createTransaction({
    transactions: transactions.map((tx) => ({
      to: tx.to,
      data: tx.data,
      value: tx.value ?? '0',
    })),
  });

  const signedTx = await safeSdk.signTransaction(safeTx);
  const result = await safeSdk.executeTransaction(signedTx);
  console.log('[Safe] executeBatchViaSafe tx:', result.hash);
  return result.hash;
}

// ── Helpers ──────────────────────────────────────────────

async function waitForTx(provider: unknown, txHash: string, maxWait = 120_000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const receipt = await (provider as Eip1193Provider).request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    }) as { status?: string } | null;
    if (receipt && receipt.status) {
      if (receipt.status === '0x0') throw new Error('Transaction reverted');
      return receipt;
    }
    await sleep(3000);
  }
  throw new Error('Transaction confirmation timeout');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
